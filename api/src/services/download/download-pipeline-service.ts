import { ParquetWriter } from '@dsnp/parquetjs';
import { PassThrough } from 'node:stream';
import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { DownloadRecord, DownloadSource, ParquetFeatureData } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { BaseFeatureRow, DownloadRepository } from '../../repositories/download/download-repository';
import { CsvPropertyDefinition } from '../../utils/csv-utils';
import { getObjectStoreBucketName } from '../../utils/file-utils';
import { createHashCountStream } from '../../utils/hash-stream';
import { buildGeoParquetMetadata, buildParquetSchema, featureToRow } from '../../utils/parquet-utils';
import { CodeService } from '../code-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { SearchFeatureService } from '../search-feature-service';
import { ArtifactService } from '../upload/artifact-service';

/**
 * Background processing pipeline for downloads.
 *
 * Called exclusively by the pg-boss job handler (processDownloadJobHandler).
 * Handles fragment planning, streaming CSV/zip generation, S3 upload, and
 * status transitions during async processing.
 *
 * Request-time operations (CRUD, auth, team linking, fragment URL delivery)
 * live in DownloadService.
 *
 * @export
 * @class DownloadPipelineService
 * @extends {DBService}
 */
export class DownloadPipelineService extends DBService {
  downloadRepository: DownloadRepository;
  searchFeatureService: SearchFeatureService;
  artifactService: ArtifactService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.searchFeatureService = new SearchFeatureService(connection);
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
   * Transition a download from one of `allowedCurrentStatuses` to `nextStatus`.
   *
   * Fetches the download, asserts the transition is allowed, then writes the new status
   * plus timestamps via the existing generic `updateDownloadStatus`. The state machine
   * lives in the service; the repository stays a thin CRUD wrapper. Illegal transitions
   * (including retries of already-terminal jobs) throw `ApiConflictError` and bubble up
   * to the pg-boss DLQ.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadStatusEnum} nextStatus - Target status.
   * @param {DownloadStatusEnum[]} allowedCurrentStatuses - Statuses from which `nextStatus` is reachable.
   * @param {{ error?: string }} [errorMetadata] - Optional error metadata (used for FAILED transitions).
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} if the download does not exist.
   * @throws {ApiConflictError} if the current status is not in `allowedCurrentStatuses`.
   * @memberof DownloadPipelineService
   */
  async transitionDownloadStatus(
    downloadId: string,
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[],
    errorMetadata?: { error?: string }
  ): Promise<void> {
    const download = await this.downloadRepository.getDownloadById(downloadId);

    this.assertDownloadStatusTransition(downloadId, download.download_status, nextStatus, allowedCurrentStatuses);

    const now = new Date().toISOString();
    const timestamps: { started_at?: string; completed_at?: string } = {};
    if (nextStatus === DownloadStatusEnum.PROCESSING) {
      timestamps.started_at = now;
    }
    if (nextStatus === DownloadStatusEnum.READY || nextStatus === DownloadStatusEnum.FAILED) {
      timestamps.completed_at = now;
    }

    await this.downloadRepository.updateDownloadStatus(downloadId, nextStatus, { ...errorMetadata, ...timestamps });
  }

  /**
   * Build schema lookup and list feature types for a Parquet download.
   *
   * The schema lookup maps feature type names to their property definitions.
   * The feature type list drives the per-type Parquet file generation loop.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadSource} source - The download source (cart or filters).
   * @return {Promise<{ schemaLookup: Map<string, CsvPropertyDefinition[]>; featureTypes: string[] }>}
   * @memberof DownloadPipelineService
   */
  async resolveParquetSchema(
    downloadId: string,
    source: DownloadSource
  ): Promise<{ schemaLookup: Map<string, CsvPropertyDefinition[]>; featureTypes: string[] }> {
    const schemaLookup = await this.buildSchemaLookup();

    let featureTypes: string[];

    if (source.cart_id) {
      featureTypes = await this.downloadRepository.listDownloadFeatureTypesByCartId(source.cart_id);
    } else if (source.filters) {
      const searchSubquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(
        source.filters,
        source.create_user
      );
      featureTypes = await this.downloadRepository.listDownloadFeatureTypesBySearchQuery(searchSubquery);
    } else {
      throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
    }

    return { schemaLookup, featureTypes };
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
   * checksum + byte_size + uploaded_at) and the download_artifact link inside the
   * caller's transaction — the worker wraps each feature type in its own
   * `withConnection`, so a mid-job retry replays the whole per-type transaction.
   *
   * Code and taxon properties arrive pre-resolved from the cursor JOIN. Parquet
   * files are standalone — GIS consumers have no database access.
   *
   * Zero disk usage: streams through PassThrough → hash → S3 multipart upload.
   *
   * @param {object} payload
   * @param {string} payload.downloadId - The download ID.
   * @param {DownloadSource} payload.source - The download source (cart or filters).
   * @param {CsvPropertyDefinition[]} payload.properties - Schema property definitions for this feature type.
   * @param {string} payload.featureTypeName - The feature type to stream.
   * @return {Promise<void>}
   * @memberof DownloadPipelineService
   */
  async writeFeatureTypeParquet(payload: {
    downloadId: string;
    source: DownloadSource;
    properties: CsvPropertyDefinition[];
    featureTypeName: string;
  }): Promise<void> {
    const { downloadId, source, properties, featureTypeName } = payload;

    const spatialColumns = properties
      .filter((p) => p.feature_property_type_name === 'spatial')
      .map((p) => p.feature_property_name);
    const schema = buildParquetSchema(properties);
    const s3Key = `downloads/${downloadId}/${featureTypeName}/data.parquet`;

    // Pipeline: Parquet writer → passThrough → hash+count transform → S3 multipart upload
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

    // PassThrough implements write()/end() but @dsnp/parquetjs types expect fs.WriteStream.
    // The runtime only calls write() and end() — safe to cast.
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

    // Open cursor for the appropriate source (cart or search filters)
    let cursor: AsyncGenerator<any[]>;
    if (source.cart_id) {
      cursor = this.downloadRepository.streamFeatureBaseByCartIdAndType(source.cart_id, featureTypeName);
    } else if (source.filters) {
      const searchSubquery = this.searchFeatureService.buildSearchFeatureIdsSubquery(
        source.filters,
        source.create_user
      );
      const { sql, bindings } = searchSubquery.toSQL().toNative();
      cursor = this.downloadRepository.streamFeatureBaseBySearchQueryAndType(
        downloadId,
        sql,
        bindings as any[],
        featureTypeName
      );
    } else {
      throw new Error(`Download ${downloadId} has neither cart_id nor filters`);
    }

    // Stream: cursor → hydrate typed properties → convert to Parquet row → write
    for await (const baseBatch of cursor) {
      const hydrated = await this.hydrateFeatureBatch(baseBatch, properties);
      for (const feature of hydrated) {
        await writer.appendRow(featureToRow(feature, properties));
      }
    }

    await writer.close();
    await uploadPromise;

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

    await this.downloadRepository.createDownloadArtifact(downloadId, artifact_id);
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
