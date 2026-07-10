import { ParquetReader } from '@dsnp/parquetjs';
import archiver from 'archiver';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS } from '../../constants/download';
import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { ExportConfig, MergeStep, OutputColumn } from '../../models/download-export-config';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionExportArtifactGroupRecord } from '../../models/download-version-export-artifact-group';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { CsvPropertyDefinition, escapeCsvField, flattenFeatureBySchema } from '../../utils/csv-utils';
import {
  buildOutputRecord,
  coerceJoinKey,
  computeDimensionProjection,
  dedupeOutputColumnNames,
  DimensionMaps,
  joinRowTransform,
  materializedColumnsForType,
  orderMergeSteps,
  STRUCTURAL_COLUMNS
} from '../../utils/export-config-utils';
import {
  buildParquetKey,
  buildPartZipKey,
  parseFeatureTypeFromParquetKey,
  shouldRollPart
} from '../../utils/export-utils';
import { _getS3Client, getObjectStoreBucketName } from '../../utils/file-utils';
import { createHashCountStream } from '../../utils/hash-stream';
import { CodeService } from '../code-service';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { ArtifactService } from '../upload/artifact-service';

/**
 * Lightweight reference to a file-type feature's binary attachment.
 *
 * Collected during CSV streaming (pass 1) and used later to stream files into
 * the archive. Mirrors the shape used by `DownloadPipelineService` so the two
 * pipelines can eventually share a helper when file-streaming lands.
 */
export interface FileFeatureRef {
  /** The submission_feature_id that owns this file. */
  submissionFeatureId: number;
  /** The S3 key / path to the original uploaded file. */
  filePath: string;
  /** The part index (1..N) this file's owning row landed in. */
  partIndex: number;
}

/**
 * Per-part archiver bundle held open while rows stream into the current zip.
 *
 * The pipeline rolls to a new part once `maxPartSizeBytes` is crossed; one of
 * these is active at a time, plus up to N already-finalized bundles tracked by
 * part index so the orchestrator can finalize in order.
 *
 * `byteCount` is the part's projected uncompressed payload size — CSV bytes
 * already written plus the `byte_size` of every binary attachment that's been
 * earmarked for this part by `collectArtifactKeyRefs`. The projection lets the
 * rollover check fire before `streamBinariesToPart` appends those binaries and
 * blows past `max_part_size_bytes`.
 */
export interface PartArchiverBundle {
  archive: archiver.Archiver;
  uploadPromise: Promise<void>;
  passThrough: PassThrough;
  hashCount: ReturnType<typeof createHashCountStream>;
  byteCount: bigint;
}

/**
 * Write a line to a PassThrough and respect back-pressure — without the `drain`
 * wait, a slow S3 leg lets the row loop out-run the pipe and the working set
 * silently grows past our bound.
 */
const writeLine = async (entry: PassThrough, line: string): Promise<void> => {
  if (!entry.write(line)) {
    await once(entry, 'drain');
  }
};

/**
 * Background processing pipeline for CSV exports.
 *
 * Called exclusively by the pg-boss group job handler. Packages a download
 * VERSION's per-feature-type Parquet artifacts once per export-artifact GROUP:
 * N identical user export requests dedupe onto a single group, so they share
 * one physical zip set instead of each re-running this expensive pipeline.
 * Rows are converted to CSV and rolled into one or more part-zips whose size is
 * bounded by the group's `max_part_size_bytes` — a read-side knob so the same
 * version can be re-exported at different part sizes without re-running the
 * Parquet pipeline. Lifecycle status and timing live on the group row, never on
 * the per-user export.
 *
 * Request-time operations (CRUD, auth, presigned URLs) live in
 * `DownloadExportService`.
 *
 * @export
 * @class DownloadExportPipelineService
 * @extends {DBService}
 */
export class DownloadExportPipelineService extends DBService {
  downloadVersionExportRepository: DownloadVersionExportRepository;
  downloadVersionRepository: DownloadVersionRepository;
  artifactService: ArtifactService;
  codeService: CodeService;
  objectStorageService: ObjectStorageService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadVersionExportRepository = new DownloadVersionExportRepository(connection);
    this.downloadVersionRepository = new DownloadVersionRepository(connection);
    this.artifactService = new ArtifactService(connection);
    this.codeService = new CodeService(connection);
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Validate an export-artifact-group status transition against an allowed
   * current-status set.
   *
   * Pure business-rule assertion; no I/O. Mirrors
   * `DownloadPipelineService.assertDownloadStatusTransition`.
   */
  private assertGroupStatusTransition(
    groupId: string,
    currentStatus: DownloadVersionExportArtifactGroupRecord['status'],
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[]
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus as DownloadStatusEnum)) {
      throw new ApiConflictError('Invalid download export status transition', [
        'DownloadExportPipelineService->transitionGroupStatus',
        { groupId, currentStatus, nextStatus, allowedCurrentStatuses }
      ]);
    }
  }

  /**
   * Transition an export-artifact group from one of `allowedCurrentStatuses` to
   * `nextStatus`.
   *
   * Fetches the group, asserts the transition is allowed, then writes the new
   * status plus timestamps via `updateExportArtifactGroupStatus`. Lifecycle
   * state lives on the GROUP (shared by every user export that dedupes onto it),
   * never on the per-user export. The state machine lives in the service; the
   * repository stays a thin CRUD wrapper. Illegal transitions (including retries
   * of already-terminal jobs) throw `ApiConflictError` and bubble up to the
   * pg-boss DLQ.
   *
   * `errorMetadata.error` is re-keyed to `error_message` to match the repo's
   * column name, mirroring the error-metadata handling of
   * `DownloadPipelineService.transitionDownloadVersionStatus` (whose metadata
   * bag additionally carries a READY-only `featureCount` that has no group
   * equivalent).
   */
  async transitionGroupStatus(
    groupId: string,
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[],
    errorMetadata?: { error?: string }
  ): Promise<void> {
    const group = await this.downloadVersionExportRepository.getExportArtifactGroupById(groupId);

    this.assertGroupStatusTransition(groupId, group.status, nextStatus, allowedCurrentStatuses);

    const now = new Date().toISOString();
    const timestamps: { started_at?: string; completed_at?: string } = {};
    if (nextStatus === DownloadStatusEnum.PROCESSING) {
      timestamps.started_at = now;
    }
    if (nextStatus === DownloadStatusEnum.READY || nextStatus === DownloadStatusEnum.FAILED) {
      timestamps.completed_at = now;
    }

    const errorMessage = errorMetadata?.error === undefined ? {} : { error_message: errorMetadata.error };

    await this.downloadVersionExportRepository.updateExportArtifactGroupStatus(groupId, nextStatus, {
      ...errorMessage,
      ...timestamps
    });
  }

  /**
   * Discover which feature-type Parquet artifacts exist for a download's
   * materialized version.
   *
   * Artifacts are discovered from the version's `download_version_artifact`
   * links, so a re-run of the parquet pipeline against the same version is the
   * unit of discovery. The Parquet object key is version-scoped
   * (`downloads/{downloadId}/versions/{downloadVersionId}/{featureTypeName}/data.parquet`),
   * so the key parse is validated against BOTH `downloadId` and
   * `downloadVersionId` — any non-matching artifact (a different version's
   * Parquet, or our own part-zip artifacts) is silently skipped via
   * `parseFeatureTypeFromParquetKey` returning null. Deduped because version
   * artifacts can accrete across retries.
   */
  async listExportFeatureTypes(downloadId: string, downloadVersionId: string): Promise<string[]> {
    const artifacts = await this.downloadVersionRepository.listDownloadVersionArtifactsByDownloadVersionId(
      downloadVersionId
    );

    const featureTypes = new Set<string>();
    for (const artifact of artifacts) {
      const featureType = parseFeatureTypeFromParquetKey(artifact.object_key, downloadId, downloadVersionId);
      if (featureType !== null) {
        featureTypes.add(featureType);
      }
    }

    return Array.from(featureTypes);
  }

  /**
   * Stream one feature type's Parquet rows through CSV conversion straight into
   * the part-local archiver, with no unbounded in-JS buffering.
   *
   * The streaming pipeline is:
   *   ParquetReader.openS3 (row-group GETs) → cursor.next()
   *     → flattenFeatureBySchema (one row)
   *     → escapeCsvField + join → line string
   *     → currentEntry.write(line)           // PassThrough for the open entry
   *     → archiver reads the PassThrough → zlib deflate
   *     → archiver.pipe(passThrough) → hashCount.transform → S3 multipart upload
   * The working set is one Parquet row group (≤ 128 MB on disk, typically
   * smaller in memory after decode) + archiver deflate buffer + AWS multipart
   * part (64 MB) — bounded regardless of survey size.
   *
   * Back-pressure: if the PassThrough's internal buffer fills, `write()`
   * returns `false` and we `await once(pt, 'drain')` before feeding the next
   * line. Without this, a slow S3 upload would let the row loop produce faster
   * than zlib + S3 can consume, defeating the bound.
   *
   * Header rule: written on every chunk so each `chunkN.csv` is independently
   * usable when opened on its own.
   *
   * Part-rolling rule: the bundle's `byteCount` tracks both uncompressed CSV
   * bytes written to the current part AND the projected `byte_size` of every
   * binary attachment earmarked for this part (looked up from the `artifact`
   * table when `collectArtifactKeyRefs` discovers an `artifact_key`). Without
   * the binary projection the part can stay under `maxPartSizeBytes` while
   * rows stream and then balloon far past it once `streamBinariesToPart`
   * appends the referenced files later. Once `byteCount` crosses
   * `maxPartSizeBytes` the method closes the current entry, returns with
   * `finalPart > currentPart`, and the orchestrator finalizes the old part
   * and creates the next bundle before re-calling this method to drain
   * what's left of the feature type's cursor.
   */
  async writeFeatureTypeExport(params: {
    groupId: string;
    downloadId: string;
    downloadVersionId: string;
    featureTypeName: string;
    properties: CsvPropertyDefinition[];
    maxPartSizeBytes: bigint;
    archiverByPart: Map<number, PartArchiverBundle>;
    currentPart: number;
    resumeCursor?: Awaited<ReturnType<ParquetReader['getCursor']>>;
    resumeReader?: ParquetReader;
    // The chunk index to start at within this feature type — continues the
    // monotonic `chunkN.csv` sequence across part-zip roll-overs so a user
    // who extracts every part side-by-side sees `chunk1.csv`, `chunk2.csv`,
    // … with stable, non-colliding names.
    resumeChunkIndex?: number;
    // Row buffered by the previous call's roll-over look-ahead. When set, the
    // resumed call processes this row first instead of re-reading the cursor —
    // the look-ahead has already advanced past it.
    resumeRow?: Record<string, unknown>;
    // The materialized column names to keep for this type (a
    // per_feature_type `output_columns` selection). The structural trace
    // columns are always kept regardless; absent ⇒ all columns, the default.
    selectedColumns?: Set<string>;
  }): Promise<{
    finalPart: number;
    chunksWritten: number;
    fileRefs: FileFeatureRef[];
    // Handed back to the caller so a roll-over can resume reading the same
    // Parquet file without re-opening (and re-fetching the footer from S3).
    pendingReader?: ParquetReader;
    pendingCursor?: Awaited<ReturnType<ParquetReader['getCursor']>>;
    pendingChunkIndex?: number;
    // The row peeked at roll-over time; the resumed call processes it before
    // pulling the cursor again.
    pendingRow?: Record<string, unknown>;
  }> {
    const { groupId, downloadId, downloadVersionId, featureTypeName, properties, maxPartSizeBytes, archiverByPart } =
      params;
    let { currentPart } = params;

    // Reuse the reader + cursor across roll-overs so we don't re-fetch the
    // Parquet footer every time a feature type spans multiple parts.
    const reader =
      params.resumeReader ?? (await this.openParquetReader(downloadId, downloadVersionId, featureTypeName));
    const cursor = params.resumeCursor ?? reader.getCursor();

    // The exact materialized column set for this type (structural trace columns —
    // submission_feature_id, uuid, parent_uuid — followed by the schema headers).
    // Derived from the shared `materializedColumnsForType` so this writer's header
    // set stays identical to what AC8 validation and the join engine check against.
    const allHeaders = materializedColumnsForType(properties);
    // A column filter (per_feature_type output_columns selection) keeps the
    // structural trace columns plus the chosen schema columns; an absent filter
    // emits every column (the default). Raw header names — per-type files have no
    // cross-type name collisions, so no rename is applied.
    const headers = params.selectedColumns
      ? allHeaders.filter(
          (header) => (STRUCTURAL_COLUMNS as readonly string[]).includes(header) || params.selectedColumns!.has(header)
        )
      : allHeaders;
    const headerLine = headers.map(escapeCsvField).join(',') + '\n';
    // Hoisted: most feature types have zero artifact_key properties, so
    // pre-filter once instead of re-scanning every row.
    const artifactKeyProperties = properties.filter((p) => p.feature_property_type_name === 'artifact_key');
    const fileRefs: FileFeatureRef[] = [];
    // Monotonic within a feature type — resumes where the previous call left
    // off, so a feature type spanning three parts emits
    // `observation/chunk1.csv`, `observation/chunk2.csv`,
    // `observation/chunk3.csv` (each in its own part-zip), not three files
    // all named `chunk1.csv` that would collide on flat-extract.
    let chunkIndex = params.resumeChunkIndex ?? 1;
    let chunksWritten = 0;

    const currentBundle = (): PartArchiverBundle => {
      const bundle = archiverByPart.get(currentPart);
      if (!bundle) {
        throw new Error(
          `DownloadExportPipelineService->writeFeatureTypeExport: no archiver bundle for part ${currentPart}`
        );
      }
      return bundle;
    };

    // Open a new zip entry backed by a PassThrough. Rows stream into the
    // PassThrough; archiver reads from it and writes to its own output pipe.
    const openChunkEntry = (): PassThrough => {
      const bundle = currentBundle();
      const entryName = `biohub-export-${groupId}/${featureTypeName}/chunk${chunkIndex}.csv`;
      const entry = new PassThrough();
      bundle.archive.append(entry, { name: entryName });
      chunksWritten += 1;
      return entry;
    };

    // Open lazily on first row so a zero-row feature type (or a cursor that
    // drains on a resumed call) produces no zip entry at all — avoids a
    // header-only `chunk1.csv` in the output.
    let currentEntry: PassThrough | null = null;

    // Look-ahead buffer: when the roll threshold is reached, we peek the
    // cursor before deciding to roll. If the peek returns null the row we
    // just wrote was the last for this feature type and rolling would create
    // an empty trailing part-zip. Otherwise we stash the peeked row here and
    // hand it back to the caller as `pendingRow`.
    let pendingRow: Record<string, unknown> | null = params.resumeRow ?? null;

    // Cache `byte_size` lookups for artifact_key references. Same key can
    // recur across rows (e.g. the same photo referenced by sibling rows);
    // the cache turns those into one DB hit instead of one per row. Lives
    // for the duration of this writer call only — across roll-overs the
    // orchestrator re-enters with a fresh map, which is fine: cross-part
    // duplicates re-resolve from the DB, and the projection still bounds
    // each part's individual rollover decision.
    const artifactSizeCache = new Map<string, bigint>();

    try {
      while (true) {
        const next = pendingRow ?? ((await cursor.next()) as Record<string, unknown> | null);
        pendingRow = null;
        if (next === null) {
          break;
        }

        // submission_feature_id is NOT NULL in the Parquet schema. INT64
        // reads come back as BigInt; `Number()` accepts both BigInt and
        // number for the int4 column range.
        const rawId = next.submission_feature_id;
        if (rawId === null || rawId === undefined) {
          throw new Error(
            `DownloadExportPipelineService->writeFeatureTypeExport: Parquet row for ${featureTypeName} is missing submission_feature_id`
          );
        }
        const submissionFeatureId = Number(rawId);
        const flattened = flattenFeatureBySchema(next, properties, submissionFeatureId, `files${currentPart}`);
        flattened['submission_feature_id'] = String(submissionFeatureId);
        // `uuid` is NOT NULL in the Parquet schema; `parent_uuid` is nullable
        // (root types like `survey` have no parent) — emit empty string so
        // the column is still present. Narrow to `string | null` rather than
        // `String(unknown)` so we don't risk an `[object Object]` stringify.
        flattened['uuid'] = (next.uuid as string | null) ?? '';
        flattened['parent_uuid'] = (next.parent_uuid as string | null) ?? '';

        const refsForRow = this.collectArtifactKeyRefs(next, artifactKeyProperties, submissionFeatureId, currentPart);
        fileRefs.push(...refsForRow);
        // Add the projected binary bytes to the bundle's byteCount BEFORE the
        // rollover check below, so a row whose attachments would push the
        // part past the cap rolls now instead of after the binaries are
        // appended in `streamBinariesToPart` (where it's too late).
        await this.accountBinaryProjection(refsForRow, artifactSizeCache, currentBundle());

        const line = headers.map((h) => escapeCsvField(flattened[h] ?? '')).join(',') + '\n';
        const lineBytes = BigInt(Buffer.byteLength(line, 'utf8'));

        // Lazy-open the chunk entry on the first row of this call; the
        // header is written on every chunk so a user opening any single
        // `chunkN.csv` sees column names without a reconstruction step.
        if (currentEntry === null) {
          currentEntry = openChunkEntry();
          await writeLine(currentEntry, headerLine);
          currentBundle().byteCount += BigInt(Buffer.byteLength(headerLine, 'utf8'));
        }

        await writeLine(currentEntry, line);
        currentBundle().byteCount += lineBytes;

        if (shouldRollPart(currentBundle().byteCount, maxPartSizeBytes)) {
          // Look ahead one row before committing to a roll. If the cursor is
          // drained, the row we just wrote was the last and rolling would
          // produce an empty trailing part-zip — close cleanly instead.
          const lookahead = (await cursor.next()) as Record<string, unknown> | null;
          if (lookahead === null) {
            currentEntry.end();
            await reader.close();
            return { finalPart: currentPart, chunksWritten, fileRefs };
          }

          // More data exists: roll to a new part and resume on the buffered
          // row. chunkIndex advances across the roll-over so the next part's
          // entry is `{featureType}/chunk{N+1}.csv` — distinct from any
          // previous part.
          currentEntry.end();
          currentEntry = null;
          currentPart += 1;
          chunkIndex += 1;
          return {
            finalPart: currentPart,
            chunksWritten,
            fileRefs,
            pendingReader: reader,
            pendingCursor: cursor,
            pendingChunkIndex: chunkIndex,
            pendingRow: lookahead
          };
        }
      }

      // Cursor drained — close the last entry for this feature type. Reader
      // is closed here because we won't resume.
      currentEntry?.end();
      await reader.close();
      return { finalPart: currentPart, chunksWritten, fileRefs };
    } catch (error) {
      // Let the error propagate to the DLQ handler; make sure we don't leak
      // the open entry or the reader.
      currentEntry?.end();
      await reader.close().catch(() => undefined);
      throw error;
    }
  }

  /**
   * Resolve the `byte_size` of any newly seen artifact_key references and
   * add them to the bundle's projected `byteCount`. Caches resolved sizes
   * within a single writer call so the same artifact key referenced by
   * multiple rows costs one DB hit, not N.
   *
   * Treats unknown keys (no matching `artifact` row) as zero — the streaming
   * path already writes a `.error.txt` placeholder for objects it can't
   * fetch, and we'd rather under-project than fail the export. The
   * projection is therefore a best-effort upper bound: a part's actual size
   * can still exceed `maxPartSizeBytes` if `byte_size` is null on the
   * artifact row, but that's a data-integrity issue the upload pipeline
   * fixes upstream.
   */
  private async accountBinaryProjection(
    refs: FileFeatureRef[],
    cache: Map<string, bigint>,
    bundle: PartArchiverBundle
  ): Promise<void> {
    if (refs.length === 0) {
      return;
    }

    const keysToLookup = refs.map((ref) => ref.filePath).filter((key) => !cache.has(key));
    if (keysToLookup.length > 0) {
      const sizes = await this.artifactService.getArtifactByteSizesByObjectKeys(
        getObjectStoreBucketName(),
        keysToLookup
      );
      for (const key of keysToLookup) {
        cache.set(key, BigInt(sizes.get(key) ?? 0));
      }
    }

    for (const ref of refs) {
      bundle.byteCount += cache.get(ref.filePath) ?? 0n;
    }
  }

  /**
   * Collect artifact-key file references from a single Parquet row. Extracted
   * from the row loop so the caller's cognitive complexity stays low and so
   * the (pure) collection rule is testable in isolation.
   */
  private collectArtifactKeyRefs(
    row: Record<string, unknown>,
    artifactKeyProperties: CsvPropertyDefinition[],
    submissionFeatureId: number,
    partIndex: number
  ): FileFeatureRef[] {
    const refs: FileFeatureRef[] = [];
    for (const prop of artifactKeyProperties) {
      const raw = (row[prop.feature_property_name] ?? row['file']) as string | undefined;
      if (raw) {
        refs.push({ submissionFeatureId, filePath: raw, partIndex });
      }
    }
    return refs;
  }

  /**
   * Open a Parquet reader against the standard per-feature-type key. Isolated
   * so `writeFeatureTypeExport` can reuse the reader across roll-overs and so
   * integration tests can stub this one seam.
   *
   * Uses the shared `_getS3Client` helper from `file-utils` so endpoint and
   * credential config stays in sync with the rest of the codebase — no inline
   * duplication of the region / path-style / env-var config.
   */
  private async openParquetReader(
    downloadId: string,
    downloadVersionId: string,
    featureTypeName: string
  ): Promise<ParquetReader> {
    return ParquetReader.openS3(_getS3Client(), {
      Bucket: getObjectStoreBucketName(),
      Key: buildParquetKey(downloadId, downloadVersionId, featureTypeName)
    });
  }

  /**
   * Finalize the given part's archiver, record the resulting artifact, and
   * link it to the export-artifact group via `download_version_export_artifact`.
   *
   * The S3 key is deterministic (via `buildPartZipKey`) so a retry overwrites
   * the same object; `insertArtifact` is idempotent on
   * `(bucket, object_key)`, and `createExportArtifactGroupArtifact` is
   * idempotent on `(download_version_export_artifact_group_id, artifact_id)` — a
   * retried part converges to the same DB + S3 state as a first-time success.
   *
   * `chunk_id` on the link row doubles as the 1-based part index for the
   * detail endpoint's `parts[]` ordering.
   */
  async writePartZip(params: {
    groupId: string;
    downloadId: string;
    downloadVersionId: string;
    partIndex: number;
    archive: archiver.Archiver;
    uploadPromise: Promise<void>;
    hashCount: ReturnType<typeof createHashCountStream>;
  }): Promise<{ artifactId: string; byteCount: number }> {
    const { groupId, downloadId, downloadVersionId, partIndex, archive, uploadPromise, hashCount } = params;

    await archive.finalize();
    await uploadPromise;

    const { sha256Hex, byteCount } = hashCount.getResult();
    const objectKey = buildPartZipKey(downloadId, downloadVersionId, groupId, partIndex);

    const { artifact_id } = await this.artifactService.insertArtifact({
      bucket: getObjectStoreBucketName(),
      object_key: objectKey,
      byte_size: byteCount,
      artifact_status: ArtifactStatusEnum.UPLOADED,
      checksum_sha256: sha256Hex,
      uploaded_at: new Date().toISOString(),
      format: 'zip'
    });

    await this.downloadVersionExportRepository.createExportArtifactGroupArtifact(groupId, artifact_id, partIndex);

    return { artifactId: artifact_id, byteCount };
  }

  /**
   * Build a lookup map from feature-type name to property definitions.
   *
   * Mirrors `DownloadPipelineService.buildSchemaLookup` so both pipelines see
   * the same schema projection. Private because the service is the sole
   * caller — callers depend on `listExportFeatureTypes` + this lookup jointly,
   * not either in isolation.
   */
  private async buildSchemaLookup(): Promise<Map<string, CsvPropertyDefinition[]>> {
    const allFeatureTypeCodes = await this.codeService.getFeatureTypePropertyCodes();

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

  /**
   * Group `output_columns` into per-feature-type column sets for the
   * `per_feature_type` column filter.
   *
   * Returns `undefined` when no selection was given so the writer falls back to
   * all columns — the omitted-output_columns default. A type absent from the
   * returned map likewise gets no filter (all its columns): selecting columns for
   * one type does not narrow another, since each per-type CSV is independent and a
   * user who scoped one type's columns still expects the rest in full.
   */
  private buildSelectedColumnsByType(outputColumns: OutputColumn[] | undefined): Map<string, Set<string>> | undefined {
    if (outputColumns === undefined) {
      return undefined;
    }

    const selectedColumnsByType = new Map<string, Set<string>>();
    for (const outputColumn of outputColumns) {
      const columns = selectedColumnsByType.get(outputColumn.feature_type) ?? new Set<string>();
      columns.add(outputColumn.column);
      selectedColumnsByType.set(outputColumn.feature_type, columns);
    }

    return selectedColumnsByType;
  }

  /**
   * Convert a raw per-type Parquet row into a materialized, CSV-ready record:
   * flatten schema properties to their materialized header names with formatted
   * values (datetime → YYYY-MM-DD / HH:MM:SS, spatial → WKT, artifact_key →
   * filePath), then re-attach the structural trace columns the flattener does not
   * own.
   *
   * The denormalized join operates on these materialized names so a config's
   * column references (validated against `materializedColumnsForType`) resolve
   * directly against the joined row. Operating on raw Parquet rows instead would
   * render datetime as integers/Dates and key artifact paths under their raw
   * property name rather than `filePath`, silently breaking those columns.
   */
  private materializeParquetRow(
    row: Record<string, unknown>,
    properties: CsvPropertyDefinition[]
  ): Record<string, string> {
    const submissionFeatureId = Number(row.submission_feature_id ?? 0);
    const flattened = flattenFeatureBySchema(row, properties, submissionFeatureId);
    // `flattenFeatureBySchema` owns only the schema properties; re-attach the
    // structural trace columns so the join can probe/output on them too.
    flattened['submission_feature_id'] = row.submission_feature_id == null ? '' : String(submissionFeatureId);
    flattened['uuid'] = (row.uuid as string | null) ?? '';
    flattened['parent_uuid'] = (row.parent_uuid as string | null) ?? '';
    return flattened;
  }

  /**
   * Build the in-memory hash maps that form the BUILD side of the denormalized
   * broadcast join — one map per distinct dimension feature type, keyed by that
   * dimension's join column.
   *
   * Each dimension is read fully into memory once (the broadcast/build side) so
   * the root can be streamed and probed against it without re-reading. Three
   * properties of this build matter:
   *
   * - **Row-count budget fail-fast.** The Parquet footer carries the row count,
   *   so a footer-only preflight rejects an over-budget dimension
   *   (`> DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS`) BEFORE buffering a single row — steering the client
   *   to the raw-Parquet download path instead of risking an out-of-memory join.
   * - **Materialize-then-trim memory bound.** Rows are read in full (no reader
   *   column projection — the flattener needs every raw input to format datetime /
   *   spatial / artifact_key), materialized, then trimmed in memory to only the
   *   columns this dimension actually contributes (`computeDimensionProjection`).
   *   The map therefore holds the minimum each dimension owes the output, not the
   *   whole wide row.
   * - **Null keys are never indexed.** A row whose join key coerces to `''`
   *   (null / absent) is skipped — SQL `NULL ≠ NULL`, so a null-keyed dimension
   *   row must never match a null-keyed root row.
   *
   * Single-column index: a dimension type is indexed by ONE join column — the
   * `right_column` of the first step that joins to it. A config that joins the
   * same dimension type on two different columns is rejected here, rather than
   * silently mis-probing the single index and returning no/wrong matches; a
   * per-column index would be needed to lift that.
   */
  private async buildDimensionMaps(params: {
    downloadId: string;
    downloadVersionId: string;
    orderedSteps: MergeStep[];
    outputColumns: OutputColumn[];
    schemaLookup: Map<string, CsvPropertyDefinition[]>;
  }): Promise<DimensionMaps> {
    const dimMaps: DimensionMaps = new Map();

    const dimensionFeatureTypes = new Set(params.orderedSteps.map((step) => step.right_feature_type));

    for (const featureType of dimensionFeatureTypes) {
      dimMaps.set(featureType, await this.buildDimensionMap(featureType, params));
    }

    return dimMaps;
  }

  /**
   * Build the BUILD-side hash map for ONE dimension feature type: resolve its
   * single join column (rejecting a config that joins the type on two different
   * columns, which would mis-probe the one index), preflight the Parquet footer
   * row count against the in-memory join budget, then buffer its rows.
   */
  private async buildDimensionMap(
    featureType: string,
    params: {
      downloadId: string;
      downloadVersionId: string;
      orderedSteps: MergeStep[];
      outputColumns: OutputColumn[];
      schemaLookup: Map<string, CsvPropertyDefinition[]>;
    }
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const { downloadId, downloadVersionId, orderedSteps, outputColumns, schemaLookup } = params;

    // Index this dimension by the first step that joins to it (one join column
    // per dimension), so every probe against this type uses one key.
    const stepsForType = orderedSteps.filter((step) => step.right_feature_type === featureType);
    const keyStep = stepsForType[0];

    // Guard the single-column-index assumption: the dimension is bucketed by
    // one `right_column`, so a second step joining the same type on a different
    // column would probe the wrong index and silently miss. Reject it loudly.
    const conflictingStep = stepsForType.find((step) => step.right_column !== keyStep.right_column);
    if (conflictingStep) {
      throw new Error(
        `Denormalized export: dimension '${featureType}' is joined on multiple columns ('${keyStep.right_column}' and '${conflictingStep.right_column}'); a dimension may be joined on only one column.`
      );
    }

    const reader = await this.openParquetReader(downloadId, downloadVersionId, featureType);
    try {
      // Footer-only preflight: reject an over-budget dimension before buffering
      // any rows so an oversize join fails fast rather than exhausting memory.
      const rowCount = Number(await reader.getRowCount());
      if (rowCount > DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS) {
        throw new Error(
          `Denormalized export: dimension '${featureType}' has ${rowCount} rows, exceeding the in-memory join budget of ${DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS} — use the raw-Parquet download path for joins this large.`
        );
      }

      const projection = computeDimensionProjection(featureType, orderedSteps, outputColumns);
      const properties = schemaLookup.get(featureType) ?? [];

      return await this.bufferDimensionRows(reader, { featureType, keyStep, projection, properties });
    } finally {
      await reader.close().catch(() => undefined);
    }
  }

  /**
   * Stream a dimension's Parquet rows into its build-side hash map — keyed by the
   * coerced join key and trimmed to the projected columns. A runtime row-count
   * backstop aborts if a corrupt/under-reporting footer streams past the in-memory
   * budget; null/empty keys are never indexed (SQL NULL ≠ NULL).
   */
  private async bufferDimensionRows(
    reader: ParquetReader,
    options: {
      featureType: string;
      keyStep: MergeStep;
      projection: Set<string>;
      properties: CsvPropertyDefinition[];
    }
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const { featureType, keyStep, projection, properties } = options;
    const map = new Map<string, Record<string, unknown>[]>();

    // FULL rows from the reader — flattening needs the raw inputs; the map is
    // trimmed to `projection` per row instead of projecting at the reader.
    const cursor = reader.getCursor();
    let rowsBuffered = 0;
    let raw = (await cursor.next()) as Record<string, unknown> | null;
    while (raw !== null) {
      // Runtime backstop for the footer preflight: a corrupt or under-reporting
      // footer could pass the row-count check yet stream more rows than the
      // budget, OOMing the worker. Abort before the map can outgrow the budget.
      rowsBuffered += 1;
      if (rowsBuffered > DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS) {
        throw new Error(
          `Denormalized export: dimension '${featureType}' streamed past the in-memory join budget of ${DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS} rows (Parquet footer under-reported its row count) — use the raw-Parquet download path for joins this large.`
        );
      }
      const materialized = this.materializeParquetRow(raw, properties);
      const key = coerceJoinKey(materialized[keyStep.right_column]);
      // Never index a null/empty key — SQL NULL ≠ NULL, so a null-keyed
      // dimension row must not match a null-keyed root row.
      if (key !== '') {
        const projected: Record<string, unknown> = {};
        for (const column of projection) {
          if (column in materialized) {
            projected[column] = materialized[column];
          }
        }
        const bucket = map.get(key) ?? [];
        bucket.push(projected);
        map.set(key, bucket);
      }
      raw = (await cursor.next()) as Record<string, unknown> | null;
    }

    return map;
  }

  /**
   * Resolve the output columns for a denormalized export, materializing the
   * "all columns" default when the config omits `output_columns`.
   *
   * Mirrors the per-type "omitted ⇒ all columns" default — and is what makes the
   * single-type, no-merge-steps passthrough emit that type's rows. The root type's
   * columns keep their RAW header names (root columns stay unprefixed on the joined
   * row); each contributed dimension type's columns omit `output_column` so
   * `buildOutputRecord` falls back to the `${feature_type}_${column}` name, which
   * keeps cross-type headers unique.
   *
   * Both paths are run through `dedupeOutputColumnNames` so the resolved header
   * names are guaranteed unique: user-supplied `output_columns` can collide (two
   * columns explicitly named the same), and even the default path can collide in
   * the contrived case of a root property literally named `${dimType}_${dimColumn}`.
   * Without this, colliding names silently overwrite one another in the CSV row.
   */
  private resolveDenormalizedOutputColumns(
    config: ExportConfig,
    orderedSteps: MergeStep[],
    schemaLookup: Map<string, CsvPropertyDefinition[]>
  ): OutputColumn[] {
    if (config.output_columns) {
      return dedupeOutputColumnNames(config.output_columns);
    }

    const rootFeatureType = config.root_feature_type!;
    const rootProperties = schemaLookup.get(rootFeatureType) ?? [];

    const outputColumns: OutputColumn[] = materializedColumnsForType(rootProperties).map((column) => ({
      feature_type: rootFeatureType,
      column,
      output_column: column
    }));

    // Each dimension contributed by a merge step, deduped in merge order, gets all
    // its materialized columns with no explicit output name (prefixed for
    // uniqueness by buildOutputRecord).
    const seenDimensions = new Set<string>();
    for (const step of orderedSteps) {
      const featureType = step.right_feature_type;
      if (seenDimensions.has(featureType)) {
        continue;
      }
      seenDimensions.add(featureType);

      const properties = schemaLookup.get(featureType) ?? [];
      for (const column of materializedColumnsForType(properties)) {
        outputColumns.push({ feature_type: featureType, column });
      }
    }

    return dedupeOutputColumnNames(outputColumns);
  }

  /**
   * Run the denormalized export: a broadcast LEFT join that streams the root
   * feature type and folds every dimension into each root row, writing the wide
   * joined rows into size-bounded part-zips.
   *
   * Shape and ordering choices captured here because they are load-bearing:
   *
   * - **Broadcast left-join, build-side first.** Every dimension is buffered in
   *   memory (`buildDimensionMaps`) BEFORE any upload opens, so an over-budget
   *   dimension fails fast without having created an archiver / multipart upload to
   *   tear down. The root is then streamed and probed against the buffers row by
   *   row — the root is never fully materialized, only one root row's bounded
   *   fan-out is live at a time.
   * - **No binary streaming.** Denormalized output is analytical tabular columns;
   *   an `artifact_key` here carries the materialized `filePath` STRING, not a
   *   bundled file. The part-zip spine is reused verbatim minus the binary
   *   projection and `streamBinariesToPart` calls.
   * - **Roll BEFORE writing.** With no binaries to project, the part can be rolled
   *   before the next row is written; because the row that triggers the roll is
   *   then written into the fresh part, the final part is guaranteed non-empty and
   *   no look-ahead is needed (unlike the per-type path).
   *
   * Retry-as-lifecycle: errors are NOT caught into a FAILED transition here — they
   * bubble to the pg-boss DLQ, which owns the FAILED transition after the retry
   * budget is exhausted (same contract as `runExportGroup`).
   */
  private async runDenormalizedExport(params: {
    groupId: string;
    downloadId: string;
    downloadVersionId: string;
    config: ExportConfig;
    maxPartSizeBytes: bigint;
    schemaLookup: Map<string, CsvPropertyDefinition[]>;
  }): Promise<void> {
    const { groupId, downloadId, downloadVersionId, config, maxPartSizeBytes, schemaLookup } = params;

    // Denormalized always has a root (validated at request time).
    const rootFeatureType = config.root_feature_type!;
    const rootProperties = schemaLookup.get(rootFeatureType) ?? [];

    const orderedSteps = orderMergeSteps(rootFeatureType, config.merge_steps);
    const outputColumns = this.resolveDenormalizedOutputColumns(config, orderedSteps, schemaLookup);

    const headers = outputColumns.map(
      (outputColumn) => outputColumn.output_column ?? `${outputColumn.feature_type}_${outputColumn.column}`
    );
    const headerLine = headers.map(escapeCsvField).join(',') + '\n';

    // Build side first: buffer every dimension so an over-budget one fails before
    // any upload opens.
    const dimMaps = await this.buildDimensionMaps({
      downloadId,
      downloadVersionId,
      orderedSteps,
      outputColumns,
      schemaLookup
    });

    const reader = await this.openParquetReader(downloadId, downloadVersionId, rootFeatureType);

    // Fail loud if the root has zero rows — otherwise we finalize an empty zip the
    // user's OS refuses to extract (mirrors the per-type empty-zip guard). Guard
    // before any bundle is created so there is nothing to tear down.
    if (Number(await reader.getRowCount()) === 0) {
      await reader.close().catch(() => undefined);
      throw new Error(
        `Export group ${groupId}: denormalized root '${rootFeatureType}' has zero rows — refusing to write an empty zip.`
      );
    }

    const archiverByPart = new Map<number, PartArchiverBundle>();
    let currentPart = 1;
    archiverByPart.set(currentPart, this.createPartArchiverBundle(groupId, downloadId, downloadVersionId, currentPart));

    const currentBundle = (): PartArchiverBundle => {
      const bundle = archiverByPart.get(currentPart);
      if (!bundle) {
        throw new Error(
          `DownloadExportPipelineService->runDenormalizedExport: no archiver bundle for part ${currentPart}`
        );
      }
      return bundle;
    };

    // chunkIndex threads across part-zips so the joined CSVs stay monotonic
    // (`chunk1.csv`, `chunk2.csv`, …) and don't collide on flat-extract.
    let chunkIndex = 1;
    let currentEntry: PassThrough | null = null;

    try {
      const cursor = reader.getCursor();
      let raw = (await cursor.next()) as Record<string, unknown> | null;
      while (raw !== null) {
        const rootRow = this.materializeParquetRow(raw, rootProperties);

        for (const joined of joinRowTransform(rootRow, rootFeatureType, orderedSteps, dimMaps)) {
          // Roll BEFORE writing: with no binaries to project, rolling here keeps
          // the final part non-empty (the triggering row lands in the fresh part).
          if (currentEntry !== null && shouldRollPart(currentBundle().byteCount, maxPartSizeBytes)) {
            currentEntry.end();
            const rolledBundle = currentBundle();
            await this.writePartZip({
              groupId,
              downloadId,
              downloadVersionId,
              partIndex: currentPart,
              archive: rolledBundle.archive,
              uploadPromise: rolledBundle.uploadPromise,
              hashCount: rolledBundle.hashCount
            });
            archiverByPart.delete(currentPart);
            currentPart += 1;
            chunkIndex += 1;
            archiverByPart.set(
              currentPart,
              this.createPartArchiverBundle(groupId, downloadId, downloadVersionId, currentPart)
            );
            currentEntry = null;
          }

          // Lazy-open the chunk entry on the first joined row of this part; the
          // header is written on every chunk so any single `chunkN.csv` is usable
          // on its own.
          if (currentEntry === null) {
            currentEntry = new PassThrough();
            currentBundle().archive.append(currentEntry, {
              name: `biohub-export-${groupId}/${rootFeatureType}/chunk${chunkIndex}.csv`
            });
            await writeLine(currentEntry, headerLine);
            currentBundle().byteCount += BigInt(Buffer.byteLength(headerLine, 'utf8'));
          }

          const record = buildOutputRecord(joined, outputColumns, rootFeatureType);
          const line = headers.map((header) => escapeCsvField(record[header] ?? '')).join(',') + '\n';
          await writeLine(currentEntry, line);
          currentBundle().byteCount += BigInt(Buffer.byteLength(line, 'utf8'));
        }

        raw = (await cursor.next()) as Record<string, unknown> | null;
      }

      currentEntry?.end();
      await reader.close().catch(() => undefined);

      // Finalize every still-open part in ascending index order (mirrors
      // runExportGroup's trailing finalize, minus the binary streaming).
      const openPartIndexes = Array.from(archiverByPart.keys()).sort((a, b) => a - b);
      for (const partIndex of openPartIndexes) {
        const bundle = archiverByPart.get(partIndex)!;
        await this.writePartZip({
          groupId,
          downloadId,
          downloadVersionId,
          partIndex,
          archive: bundle.archive,
          uploadPromise: bundle.uploadPromise,
          hashCount: bundle.hashCount
        });
        archiverByPart.delete(partIndex);
      }
    } catch (error) {
      currentEntry?.end();
      await reader.close().catch(() => undefined);
      this.abortOpenArchivers(archiverByPart);
      throw error;
    }
  }

  /**
   * Create a fresh archiver bundle for the given part index.
   *
   * Each part has its own archiver + S3 multipart upload so finalizing one
   * part doesn't stall while the next part is still accepting rows. The
   * hash-count transform sits between the archiver and S3 so the checksum and
   * byte-size captured by `writePartZip` exactly match the bytes uploaded.
   *
   * **Error propagation:** without an `archive.on('error', ...)` listener, a
   * zlib failure or archiver internal error would both (a) emit as an
   * unhandled exception and (b) leave the S3 multipart upload waiting on a
   * pipe that never closes — `uploadPromise` would hang forever. Routing the
   * error into `passThrough.destroy(err)` tears down the entire downstream
   * pipeline (passThrough → hashCount → S3 upload) so `uploadPromise`
   * rejects, which `writePartZip` / `runExportGroup` can observe.
   */
  private createPartArchiverBundle(
    groupId: string,
    downloadId: string,
    downloadVersionId: string,
    partIndex: number
  ): PartArchiverBundle {
    const archive = archiver('zip', { zlib: { level: 5 } });
    const passThrough = new PassThrough();
    const hashCount = createHashCountStream();

    archive.on('error', (err) => {
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);
    passThrough.pipe(hashCount.transform);

    const uploadPromise = this.objectStorageService.uploadStream(
      BucketType.MAIN,
      hashCount.transform,
      'application/zip',
      buildPartZipKey(downloadId, downloadVersionId, groupId, partIndex)
    );

    return { archive, uploadPromise, passThrough, hashCount, byteCount: 0n };
  }

  /**
   * Orchestrate the CSV export pipeline end-to-end for one export-artifact group.
   *
   * Sequence:
   *  1. Transition PENDING → PROCESSING (idempotent — re-entering a running
   *     group is allowed so pg-boss retries converge).
   *  2. Resolve the version the group is pinned to, then the per-type schema
   *     lookup.
   *  3. Branch on the config's `mode`:
   *     - `denormalized` → `runDenormalizedExport` (broadcast join into wide
   *       CSV rows), then transition READY and return.
   *     - `per_feature_type` (default) → for each configured feature type, stream
   *       Parquet rows into the current part's CSV chunks, rolling to a new part
   *       once the group's `max_part_size_bytes` is crossed.
   *  4. Finalize every open part via `writePartZip`, in index order.
   *  5. Transition PROCESSING → READY.
   *
   * The version is resolved from the GROUP (`group.download_version_id`), not
   * from the download's most-recent version. The group is pinned to the specific
   * version it was created against, so a later re-run of the download — which
   * creates a NEW version rather than mutating the parent — does NOT change what
   * this group packages. Re-reading the latest version would silently zip a newer
   * version's artifacts; resolving from the group eliminates that drift.
   *
   * Feature types are processed sequentially, not in parallel, to cap memory:
   * a version with tens of types and hundreds of thousands of rows would
   * otherwise risk OOM in a single pg-boss worker process. Per-type buffering
   * is the bound.
   *
   * Retry-as-lifecycle: errors are NOT caught here. pg-boss records the
   * failure and the DLQ handler owns the FAILED transition — duplicating it
   * would mask the root cause and race the retry path.
   */
  async runExportGroup(groupId: string): Promise<void> {
    await this.transitionGroupStatus(groupId, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING,
      DownloadStatusEnum.PROCESSING
    ]);

    const group = await this.downloadVersionExportRepository.getExportArtifactGroupById(groupId);

    // Resolve the version the group is pinned to (NOT the download's current
    // version) so a later re-materialization of the download doesn't change what
    // this group packages. getDownloadVersionById throws ApiNotFoundError if the
    // version is gone — that absence is the guard.
    const version = await this.downloadVersionRepository.getDownloadVersionById(group.download_version_id);
    const downloadId = version.download_id;
    const downloadVersionId = group.download_version_id;

    const schemaLookup = await this.buildSchemaLookup();
    const config = group.config;
    const maxPartSizeBytes = BigInt(group.max_part_size_bytes);

    // Denormalized mode joins the per-type Parquet into wide CSV rows; it owns its
    // own part-zip spine (no binary streaming) and finalizes inside the call.
    if (config.mode === 'denormalized') {
      await this.runDenormalizedExport({
        groupId,
        downloadId,
        downloadVersionId,
        config,
        maxPartSizeBytes,
        schemaLookup
      });
      await this.transitionGroupStatus(groupId, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);
      return;
    }

    // per_feature_type: emit one CSV per configured type. Discovery finds every
    // materialized type; restrict it to the config's selection so a type that was
    // materialized but not requested is not exported.
    const selectedColumnsByType = this.buildSelectedColumnsByType(config.output_columns);
    const featureTypes = (await this.listExportFeatureTypes(downloadId, downloadVersionId)).filter((featureType) =>
      config.feature_types.includes(featureType)
    );

    // Fail loud if the version has no Parquet artifacts — otherwise the
    // archiver finalizes an empty zip (just the central-directory record) and the
    // user downloads a file their OS refuses to extract. Retry-as-lifecycle: the
    // DLQ handler transitions the group to FAILED after the pg-boss retry budget
    // is exhausted, and the error_message is propagated to the card.
    if (featureTypes.length === 0) {
      throw new Error(
        `Export group ${groupId}: version ${downloadVersionId} has no Parquet artifacts to export — refusing to write an empty zip.`
      );
    }

    const archiverByPart = new Map<number, PartArchiverBundle>();
    let currentPart = 1;

    archiverByPart.set(currentPart, this.createPartArchiverBundle(groupId, downloadId, downloadVersionId, currentPart));

    // Binary file references are collected as rows stream by, grouped by the
    // part index the referring row landed in. Each part's binaries must stream
    // into that part's archiver BEFORE the part is finalized — whether that
    // finalize happens on roll-over (mid-stream, for memory bounds) or at the
    // end. Once a part is finalized its bucket is removed from the map so the
    // working set tracks only still-open parts (mirrors `archiverByPart`),
    // turning the per-part lookup into O(refs-in-this-part) instead of
    // O(all-refs-ever).
    const fileRefsByPart = new Map<number, FileFeatureRef[]>();
    let totalChunksWritten = 0;

    try {
      for (const featureTypeName of featureTypes) {
        const properties = schemaLookup.get(featureTypeName) ?? [];

        // A feature type may span multiple parts. Loop until the writer reports
        // it drained the cursor for this type. On a roll-over return, finalize
        // the just-closed part and open a new bundle before resuming the same
        // cursor (handed back via `pendingReader` + `pendingCursor` +
        // `pendingChunkIndex`). The chunk index threads across the roll-over so
        // `observation/chunk1.csv`, `observation/chunk2.csv`, … stay monotonic
        // across part-zips and don't collide on flat-extract.
        let pendingReader: ParquetReader | undefined;
        let pendingCursor: Awaited<ReturnType<ParquetReader['getCursor']>> | undefined;
        let pendingChunkIndex: number | undefined;
        let pendingRow: Record<string, unknown> | undefined;

        while (true) {
          const result = await this.writeFeatureTypeExport({
            groupId,
            downloadId,
            downloadVersionId,
            featureTypeName,
            properties,
            maxPartSizeBytes,
            archiverByPart,
            currentPart,
            resumeReader: pendingReader,
            resumeCursor: pendingCursor,
            resumeChunkIndex: pendingChunkIndex,
            resumeRow: pendingRow,
            selectedColumns: selectedColumnsByType?.get(featureTypeName)
          });

          for (const ref of result.fileRefs) {
            const partRefs = fileRefsByPart.get(ref.partIndex) ?? [];
            partRefs.push(ref);
            fileRefsByPart.set(ref.partIndex, partRefs);
          }
          totalChunksWritten += result.chunksWritten;

          if (result.pendingReader === undefined || result.pendingCursor === undefined) {
            // Cursor drained.
            break;
          }

          // Roll-over: stream this part's binaries in, then finalize so its
          // S3 upload drains and its archiver buffer frees. Binaries go in
          // BEFORE finalize — otherwise the part's CSV references files that
          // never land in the zip.
          const oldPartIndex = currentPart;
          const oldBundle = archiverByPart.get(oldPartIndex)!;
          await this.streamBinariesToPart(
            oldBundle,
            fileRefsByPart.get(oldPartIndex) ?? [],
            groupId,
            oldPartIndex,
            this.objectStorageService
          );
          await this.writePartZip({
            groupId,
            downloadId,
            downloadVersionId,
            partIndex: oldPartIndex,
            archive: oldBundle.archive,
            uploadPromise: oldBundle.uploadPromise,
            hashCount: oldBundle.hashCount
          });
          archiverByPart.delete(oldPartIndex);
          fileRefsByPart.delete(oldPartIndex);

          currentPart = result.finalPart;
          archiverByPart.set(
            currentPart,
            this.createPartArchiverBundle(groupId, downloadId, downloadVersionId, currentPart)
          );
          pendingReader = result.pendingReader;
          pendingCursor = result.pendingCursor;
          pendingChunkIndex = result.pendingChunkIndex;
          pendingRow = result.pendingRow;
        }
      }

      // Every discovered feature type produced zero rows — the Parquet files
      // exist but contain no data. Fail loud rather than finalize an empty zip
      // the user's OS will refuse to extract.
      if (totalChunksWritten === 0) {
        throw new Error(
          `Export group ${groupId}: every feature type resolved to zero rows (${featureTypes.join(
            ', '
          )}) — refusing to write an empty zip.`
        );
      }

      // Finalize any still-open parts in ascending index order. Stream each
      // part's binaries in before its writePartZip — mirrors the roll-over
      // path.
      const openPartIndexes = Array.from(archiverByPart.keys()).sort((a, b) => a - b);
      for (const partIndex of openPartIndexes) {
        const bundle = archiverByPart.get(partIndex)!;
        await this.streamBinariesToPart(
          bundle,
          fileRefsByPart.get(partIndex) ?? [],
          groupId,
          partIndex,
          this.objectStorageService
        );
        await this.writePartZip({
          groupId,
          downloadId,
          downloadVersionId,
          partIndex,
          archive: bundle.archive,
          uploadPromise: bundle.uploadPromise,
          hashCount: bundle.hashCount
        });
        archiverByPart.delete(partIndex);
        fileRefsByPart.delete(partIndex);
      }
    } catch (error) {
      this.abortOpenArchivers(archiverByPart);
      throw error;
    }

    await this.transitionGroupStatus(groupId, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);
  }

  /**
   * Abort any still-open archivers so their S3 multipart uploads reject and
   * release resources instead of hanging as orphaned promises.
   *
   * `archive.abort()` cascades to the passThrough via our error listener in
   * `createPartArchiverBundle`, which in turn fails the upload. Status stays
   * `processing` — pg-boss retries or the DLQ handler sets FAILED
   * (retry-as-lifecycle).
   */
  private abortOpenArchivers(archiverByPart: Map<number, PartArchiverBundle>): void {
    for (const bundle of archiverByPart.values()) {
      // Swallow upload rejection first so `archive.abort()`-induced errors
      // don't surface as unhandled promise rejections.
      bundle.uploadPromise.catch(() => undefined);
      try {
        bundle.archive.abort();
      } catch {
        // archive.abort() throws if already finalized; ignore.
      }
    }
    archiverByPart.clear();
  }

  /**
   * Stream a part's binary attachments into its archiver under
   * `files{N}/` — one file at a time, waiting for archiver to consume each
   * entry before opening the next S3 stream. Without this serialization, a
   * part referencing N binaries would open N S3 connections simultaneously
   * and queue them all in archiver's buffer, defeating the bounded-memory
   * guarantee. Must be called BEFORE the part is finalized via `writePartZip`
   * — the roll-over path and the trailing finalize path both depend on this.
   */
  private async streamBinariesToPart(
    bundle: PartArchiverBundle,
    fileRefs: FileFeatureRef[],
    groupId: string,
    partIndex: number,
    objectStorageService: ObjectStorageService
  ): Promise<void> {
    for (const ref of fileRefs) {
      const fileName = ref.filePath.split('/').pop() ?? 'file';
      const entryName = `biohub-export-${groupId}/files${partIndex}/${ref.submissionFeatureId}_${fileName}`;
      await this.appendBinaryToArchive(bundle.archive, objectStorageService, ref.filePath, entryName);
    }
  }

  /**
   * Append one binary file from S3 into the archive, waiting for archiver to
   * fully consume the entry before returning. If the S3 fetch fails, appends
   * an `${entryName}.error.txt` placeholder instead of throwing — a single
   * missing attachment should not fail the whole export. Mirrors
   * `DownloadPipelineService.streamFilesToArchive`.
   */
  private async appendBinaryToArchive(
    archive: archiver.Archiver,
    objectStorageService: ObjectStorageService,
    filePath: string,
    entryName: string
  ): Promise<void> {
    const entryProcessed = new Promise<void>((resolve, reject) => {
      const onEntry = () => {
        archive.removeListener('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        archive.removeListener('entry', onEntry);
        reject(err);
      };
      archive.once('entry', onEntry);
      archive.once('error', onError);
    });

    try {
      const fileStream = await objectStorageService.getFileStream(BucketType.MAIN, filePath);
      archive.append(fileStream, { name: entryName });
    } catch {
      // Binary fetch failed (missing from S3, permission change, TTL expiry).
      // Append a placeholder so the rest of the export still succeeds — whole-
      // export-fails semantics apply to pipeline-level failures, not to
      // individual missing attachments.
      archive.append(`Error: could not retrieve file from ${filePath}`, { name: `${entryName}.error.txt` });
    }

    await entryProcessed;
  }
}
