import { ParquetWriter } from '@dsnp/parquetjs';
import { Knex } from 'knex';
import { PassThrough } from 'node:stream';
import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { DATETIME_DATE_SUFFIX, DATETIME_TIME_SUFFIX } from '../../models/datetime-column';
import { DownloadRecord, DownloadSource, ParquetFeatureData } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ActivePolicyStatementWithExpression } from '../../repositories/authorization/policy-statement-repository';
import { BaseFeatureRow, DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { dependencies as expressionEvaluation } from '../../repositories/expression-evaluation';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { createHashCountStream } from '../../utils/hash-stream';
import { buildGeoParquetMetadata, buildParquetSchema, featureToRow } from '../../utils/parquet-utils';
import { PolicyStatementService } from '../access-policy/policy-statement-service';
import { CodeService } from '../code-service';
import { DBService } from '../db-service';
import { ExpressionTreeService } from '../expression-tree-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';

/**
 * Payload for `DownloadPipelineService.writeFeatureTypeParquet`.
 *
 * `downloadId` keys the deterministic S3 object key; `downloadVersionId` is the
 * temporal axis the produced artifact is linked to in `download_version_artifact`,
 * so the export pipeline can rediscover the version's Parquet files without
 * re-running the original search.
 */
export interface WriteFeatureTypeParquetPayload {
  downloadId: string;
  downloadVersionId: string;
  source: DownloadSource;
  properties: CsvPropertyDefinition[];
  featureTypeName: string;
  statement: ActivePolicyStatementWithExpression;
}

/**
 * Background processing pipeline for downloads.
 *
 * Called exclusively by the pg-boss job handler (processDownloadJobHandler).
 * Handles Parquet generation, S3 upload, and status transitions during async
 * processing.
 *
 * Request-time operations (CRUD, auth, team linking) live in DownloadService.
 *
 * @export
 * @class DownloadPipelineService
 * @extends {DBService}
 */
export class DownloadPipelineService extends DBService {
  downloadRepository: DownloadRepository;
  downloadVersionRepository: DownloadVersionRepository;
  expressionTreeService: ExpressionTreeService;
  policyStatementService: PolicyStatementService;
  artifactService: ArtifactService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.downloadVersionRepository = new DownloadVersionRepository(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.policyStatementService = new PolicyStatementService(connection);
    this.artifactService = new ArtifactService(connection);
  }

  /**
   * Validate a download status transition against an allowed current-status set.
   *
   * Pure business-rule assertion; no I/O.
   *
   * @param {string} downloadId - The download ID (for error context).
   * @param {DownloadRecord['download_status']} currentStatus - The download's current status.
   * @param {DownloadStatusEnum} nextStatus - The status being transitioned to.
   * @param {DownloadStatusEnum[]} allowedCurrentStatuses - Statuses from which `nextStatus` is reachable.
   * @return {void}
   * @throws {ApiConflictError} if `currentStatus` is not in `allowedCurrentStatuses`.
   * @memberof DownloadPipelineService
   */
  private assertDownloadStatusTransition(
    downloadId: string,
    currentStatus: DownloadRecord['download_status'],
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[]
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus as DownloadStatusEnum)) {
      throw new ApiConflictError('Invalid download status transition', [
        'DownloadPipelineService->transitionDownloadStatus',
        { downloadId, currentStatus, nextStatus, allowedCurrentStatuses }
      ]);
    }
  }

  /**
   * Transition a download's current version from one of `allowedCurrentStatuses` to `nextStatus`.
   *
   * The materialization lifecycle lives on the version (a version IS a materialization),
   * so the transition writes `download_version`, not `download`. The download's status is
   * read back from its current version, so callers keep the download-id contract while the
   * write lands on the version. The state machine lives in the service; the repository stays
   * a thin CRUD wrapper. Illegal transitions (including retries of already-terminal jobs)
   * throw `ApiConflictError` and bubble up to the pg-boss DLQ.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadStatusEnum} nextStatus - Target status.
   * @param {DownloadStatusEnum[]} allowedCurrentStatuses - Statuses from which `nextStatus` is reachable.
   * @param {{ error?: string }} [errorMetadata] - Optional error metadata (used for FAILED transitions).
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} if the download does not exist.
   * @throws {ApiConflictError} if the download has no current version, or the current status is not in `allowedCurrentStatuses`.
   * @memberof DownloadPipelineService
   */
  async transitionDownloadStatus(
    downloadId: string,
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[],
    errorMetadata?: { error?: string }
  ): Promise<void> {
    const download = await this.downloadRepository.getDownloadById(downloadId);

    // A committed download always has a current version (created in the same request
    // transaction). Guard narrows the nullable pointer and surfaces the impossible case.
    if (download.current_download_version_id === null) {
      throw new ApiConflictError('Download has no materialized version', [
        'DownloadPipelineService->transitionDownloadStatus',
        { downloadId, nextStatus }
      ]);
    }

    this.assertDownloadStatusTransition(downloadId, download.download_status, nextStatus, allowedCurrentStatuses);

    const now = new Date().toISOString();
    const metadata: { started_at?: string; completed_at?: string; materialized_at?: string; error_message?: string } =
      {};
    if (nextStatus === DownloadStatusEnum.PROCESSING) {
      metadata.started_at = now;
    }
    if (nextStatus === DownloadStatusEnum.READY || nextStatus === DownloadStatusEnum.FAILED) {
      metadata.completed_at = now;
    }
    // materialized_at is the data watermark — when this version's snapshot was captured.
    if (nextStatus === DownloadStatusEnum.READY) {
      metadata.materialized_at = now;
    }
    if (errorMetadata?.error !== undefined) {
      metadata.error_message = errorMetadata.error;
    }

    await this.downloadVersionRepository.updateDownloadVersionStatus(
      download.current_download_version_id,
      nextStatus,
      metadata
    );
  }

  /**
   * Resolve the per-feature-type schema and the active policy statements that drive
   * a Parquet download.
   *
   * The download's policy is the single source of truth for both the list of feature
   * types to export and (per type) whether to filter by an expression tree or to
   * project the broad feature-type set. Returning the full statements list alongside
   * the schema lookup keeps the caller's per-type loop to a single fetch — the
   * matching statement is threaded into `writeFeatureTypeParquet` instead of being
   * re-queried per type.
   *
   * Feature types come back in `urn_feature_type` ASC order so the downstream loop
   * produces a stable, alphabetic sequence of Parquet files.
   *
   * @param {DownloadSource} source - The download source (policy_id + requested_by).
   * @return {Promise<{ schemaLookup: Map<string, CsvPropertyDefinition[]>; featureTypes: string[]; statements: ActivePolicyStatementWithExpression[] }>}
   * @memberof DownloadPipelineService
   */
  async resolveParquetSchema(source: DownloadSource): Promise<{
    schemaLookup: Map<string, CsvPropertyDefinition[]>;
    featureTypes: string[];
    statements: ActivePolicyStatementWithExpression[];
  }> {
    const schemaLookup = await this.buildSchemaLookup();
    const statements = await this.policyStatementService.getActiveStatementsWithExpressionByPolicyId(source.policy_id);
    const featureTypes = statements.map((statement) => statement.urn_feature_type);
    return { schemaLookup, featureTypes, statements };
  }

  /**
   * Stream a single feature type to a Parquet file on S3, recording the artifact
   * with authoritative checksum and byte size.
   *
   * The S3 key is deterministic: `downloads/{downloadId}/{featureTypeName}/data.parquet`.
   * Retries overwrite the same key — S3 is idempotent on overwrites, and the
   * artifact / download_artifact inserts are idempotent on unique keys. A retried
   * feature type converges to the same DB + S3 state as a first-time success.
   *
   * Pipeline: cursor → hydrateFeatureBatch → featureToRow → writer → passThrough →
   * hash-count transform → S3 multipart upload. The hash transform captures
   * sha256Hex + byteCount from the exact bytes uploaded; hashing after the fact
   * would require re-downloading the S3 object.
   *
   * Writes the artifact row (`format='parquet'`, `artifact_status='uploaded'`, real
   * checksum + byte_size + uploaded_at) and the download_version_artifact link inside
   * the caller's transaction — the worker wraps each feature type in its own
   * `withConnection`, so a mid-job retry replays the whole per-type transaction. The
   * artifact is linked to `downloadVersionId` (the download's materialized version),
   * not the download directly, so the export pipeline can rediscover the version's
   * Parquet files.
   *
   * Code and taxon properties arrive pre-resolved from the cursor JOIN. Parquet
   * files are standalone — GIS consumers have no database access.
   *
   * Zero disk usage: streams through PassThrough → hash → S3 multipart upload.
   *
   * Per-statement evaluation: `payload.statement` is the resolved policy statement
   * for this feature type. When `expression_id` is set, the expression tree drives
   * the feature-id subquery; when null, a broad subquery over the whole feature
   * type is used. In both branches the security filter is applied for
   * `source.requested_by` so visibility is judged at export time against the
   * requesting user's authorization scope — not the audit `create_user` or the
   * worker's own connection grants.
   *
   * @param {WriteFeatureTypeParquetPayload} payload
   * @param {string} payload.downloadId - The download ID.
   * @param {string} payload.downloadVersionId - The download's materialized version; the produced artifact is linked to it.
   * @param {DownloadSource} payload.source - The download source (policy_id + requested_by).
   * @param {CsvPropertyDefinition[]} payload.properties - Schema property definitions for this feature type.
   * @param {string} payload.featureTypeName - The feature type to stream.
   * @param {ActivePolicyStatementWithExpression} payload.statement - The active policy statement for this feature type.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async writeFeatureTypeParquet(payload: WriteFeatureTypeParquetPayload): Promise<void> {
    const { downloadId, downloadVersionId, source, properties, featureTypeName, statement } = payload;

    const spatialColumns = properties
      .filter((p) => p.feature_property_type_name === 'spatial')
      .map((p) => p.feature_property_name);
    const schema = buildParquetSchema(properties);
    const s3Key = `downloads/${downloadId}/${featureTypeName}/data.parquet`;

    // Resolve every precondition (expression read, semantic validation, subquery
    // build, cursor setup) BEFORE starting the S3 multipart upload. The upload
    // holds an open multipart context; if any of these throw after upload startup,
    // the abort path can't run and the upload either hangs or leaks. Building the
    // cursor descriptor is cheap and side-effect-free until the stream is iterated.
    //
    // The expression evaluator consumes the *normalized* internal tree shape
    // (predicates carry resolved property type metadata). `readExpressionTree`
    // returns the public API tree, so we re-normalize through the same semantic
    // validator the search path uses — keeping read-time SQL semantics identical
    // for the two consumers of the evaluator.
    let subquery: Knex.QueryBuilder;
    if (statement.expression_id === null) {
      subquery = expressionEvaluation.buildBroadFeatureTypeSubquery(featureTypeName, source.requested_by);
    } else {
      const tree = await this.expressionTreeService.readExpressionTree(statement.expression_id);
      const normalizedTree = await this.expressionTreeService.semanticValidator.validateExpressionTree(tree);
      subquery = expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
        featureTypeName,
        normalizedTree,
        source.requested_by
      );
    }

    const { sql, bindings } = subquery.toSQL().toNative();
    const cursor = this.downloadRepository.streamFeatureBaseBySearchQueryAndType(
      downloadId,
      sql,
      bindings as any[],
      featureTypeName
    );

    // Pipeline: Parquet writer → passThrough → hash+count transform → S3 multipart upload.
    //
    // Wrapped so a partial failure does not leak the multipart upload or leave the
    // PassThrough → hashCountTransform pipe alive holding worker memory. On failure:
    // destroy the input stream (which cascades into an Upload abort), then await +
    // swallow the now-rejected uploadPromise so the original error surfaces
    // unobscured. Without this, a thrown `appendRow`/`hydrateFeatureBatch` (or any
    // earlier set-up failure inside this block) returns control to the caller before
    // S3 sees end-of-stream and the multipart upload either hangs until network
    // timeout or surfaces as an unhandled rejection.
    const passThrough = new PassThrough();
    const { transform: hashCountTransform, getResult } = createHashCountStream();
    passThrough.pipe(hashCountTransform);

    const objectStorageService = new ObjectStorageService();
    const uploadPromise = objectStorageService.uploadStream(
      BucketType.MAIN,
      hashCountTransform,
      'application/octet-stream',
      s3Key
    );

    let streamingSucceeded = false;
    try {
      // PassThrough implements write()/end() but @dsnp/parquetjs types expect
      // fs.WriteStream. The runtime only calls write() and end() — safe to cast.
      const writer = await ParquetWriter.openStream(schema, passThrough as any);

      // GeoParquet 1.0 metadata must be attached via setMetadata(), not the openStream
      // options bag: @dsnp/parquetjs silently discards `opts.metadata` — the writer
      // constructor initializes `userMetadata = {}` without reading the option (see
      // node_modules/@dsnp/parquetjs/dist/lib/writer.js:107). setMetadata() writes to
      // userMetadata, which is emitted to the footer on close(). Without this call,
      // GeoParquet-aware readers (DuckDB spatial, GeoPandas, ogr2ogr) cannot detect
      // the geometry column, CRS, or WKB encoding.
      if (spatialColumns.length > 0) {
        writer.setMetadata('geo', buildGeoParquetMetadata(spatialColumns));
      }

      // Stream: cursor → hydrate typed properties → convert to Parquet row → write.
      for await (const baseBatch of cursor) {
        const hydrated = await this.hydrateFeatureBatch(baseBatch, properties);
        for (const feature of hydrated) {
          await writer.appendRow(featureToRow(feature, properties));
        }
      }

      await writer.close();
      await uploadPromise;
      streamingSucceeded = true;
    } finally {
      if (!streamingSucceeded) {
        // The upload consumer sees abort via the rejected uploadPromise. The
        // source PassThrough has no other consumer, so its `error` event would
        // otherwise go uncaught and crash the worker — register a no-op
        // listener before tearing down. Same for the upload promise itself: it
        // will eventually settle (reject) and we don't want an unhandled
        // rejection if we move on without awaiting.
        passThrough.on('error', () => undefined);
        uploadPromise.catch(() => undefined);
        passThrough.destroy(new Error(`writeFeatureTypeParquet aborted for ${downloadId}/${featureTypeName}`));

        // Bounded wait for the upload to abort cleanly — gives the AWS SDK a
        // chance to settle so the surrounding transaction can rollback against
        // a clean connection. Some implementations (real S3 multipart uploads
        // mid-buffer) do not promptly observe the source destroy; we cap the
        // wait so a sticky upload can't deadlock the worker. The original error
        // from the try block surfaces immediately when the race resolves.
        const abortDeadlineMs = 5000;
        await Promise.race([
          uploadPromise.then(
            () => undefined,
            () => undefined
          ),
          new Promise<void>((resolve) => setTimeout(resolve, abortDeadlineMs))
        ]);
      }
    }

    const { sha256Hex, byteCount } = getResult();

    // Record the artifact with the bytes we just uploaded. insertArtifact is
    // idempotent on (bucket, object_key) — on retry it returns the existing
    // artifact_id rather than inserting a duplicate.
    const { artifact_id } = await this.artifactService.insertArtifact({
      bucket: getObjectStoreBucketName(),
      object_key: s3Key,
      byte_size: byteCount,
      artifact_status: ArtifactStatusEnum.UPLOADED,
      checksum_sha256: sha256Hex,
      uploaded_at: new Date().toISOString(),
      format: 'parquet'
    });

    await this.downloadVersionRepository.createDownloadVersionArtifact(downloadVersionId, artifact_id, featureTypeName);
  }

  /**
   * Hydrate a batch of base feature rows with typed property values.
   *
   * Fetches values from typed `submission_feature_property_*` tables via the
   * repository, then assembles them into `ParquetFeatureData` records.
   *
   * Properties without typed tables (array, object, artifact_key) fall back to
   * `submission_feature.data.properties` — these types have dynamic internal
   * structure that can't be represented as a single typed value.
   *
   * @param {BaseFeatureRow[]} baseBatch - Base feature rows from a cursor stream.
   * @param {CsvPropertyDefinition[]} properties - Schema property definitions.
   * @return {Promise<ParquetFeatureData[]>}
   * @memberof DownloadPipelineService
   */
  async hydrateFeatureBatch(
    baseBatch: BaseFeatureRow[],
    properties: CsvPropertyDefinition[]
  ): Promise<ParquetFeatureData[]> {
    // Types that live in the JSONB blob rather than typed tables
    const JSONB_FALLBACK_TYPES = new Set(['array', 'object', 'artifact_key']);

    // Determine which typed tables need querying
    const typedPropertyTypes = [
      ...new Set(properties.map((p) => p.feature_property_type_name).filter((t) => !JSONB_FALLBACK_TYPES.has(t)))
    ];

    const submissionFeatureIds = baseBatch.map((row) => row.submission_feature_id);

    // Fetch raw typed rows from the repository
    const typedRows =
      typedPropertyTypes.length > 0
        ? await this.downloadRepository.fetchTypedPropertyRows(submissionFeatureIds, typedPropertyTypes)
        : [];

    // Build property map: submission_feature_id → { propName: value }
    const propertyMap = new Map<number, Record<string, any>>();
    for (const row of typedRows) {
      if (!propertyMap.has(row.submission_feature_id)) {
        propertyMap.set(row.submission_feature_id, {});
      }
      propertyMap.get(row.submission_feature_id)![row.name] = row.value;
    }

    // Assemble ParquetFeatureData for each base row
    return baseBatch.map((baseRow) => {
      const typedProps = propertyMap.get(baseRow.submission_feature_id) ?? {};
      const data: Record<string, any> = {};

      for (const prop of properties) {
        const propName = prop.feature_property_name;

        if (JSONB_FALLBACK_TYPES.has(prop.feature_property_type_name)) {
          // Array/object/artifact_key: fall back to JSONB data.properties
          data[propName] = baseRow.data?.properties?.[propName] ?? null;
        } else if (prop.feature_property_type_name === 'datetime') {
          // `datetime` properties are projected as two synthetic rows by
          // `fetchTypedPropertyRows` with suffixed `name` values
          // (`<prop>_date`, `<prop>_time`). The hydrator mirrors that
          // expansion: each datetime property writes two `data` keys, one or
          // both of which may be null for partial-component rows. Suffix
          // constants live in `models/datetime-column.ts`; the SQL projection
          // uses the same constants — drift silently nulls cells.
          const dateKey = `${propName}${DATETIME_DATE_SUFFIX}`;
          const timeKey = `${propName}${DATETIME_TIME_SUFFIX}`;
          data[dateKey] = typedProps[dateKey] ?? null;
          data[timeKey] = typedProps[timeKey] ?? null;
        } else if (propName in typedProps) {
          data[propName] = typedProps[propName];
        } else {
          data[propName] = null;
        }
      }

      return {
        submission_feature_id: baseRow.submission_feature_id,
        uuid: baseRow.uuid,
        feature_type_name: baseRow.feature_type_name,
        data,
        parent_uuid: baseRow.parent_uuid
      };
    });
  }

  /**
   * Build a lookup map from feature type name to property definitions.
   */
  private async buildSchemaLookup(): Promise<Map<string, CsvPropertyDefinition[]>> {
    const codeService = new CodeService(this.connection);
    const allFeatureTypeCodes = await codeService.getFeatureTypePropertyCodes();

    const lookup = new Map<string, CsvPropertyDefinition[]>();
    for (const ftCode of allFeatureTypeCodes) {
      lookup.set(
        ftCode.feature_type.name,
        ftCode.properties.map((p) => ({
          feature_property_name: p.name,
          feature_property_type_name: p.type_name
        }))
      );
    }
    return lookup;
  }
}
