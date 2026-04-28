import { ParquetReader } from '@dsnp/parquetjs';
import archiver from 'archiver';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { ArtifactStatusEnum } from '../../models/artifact';
import { DownloadExportRecord } from '../../models/download-export';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadRepository } from '../../repositories/download/download-repository';
import {
  buildSchemaHeaders,
  CsvPropertyDefinition,
  escapeCsvField,
  flattenFeatureBySchema
} from '../../utils/csv-utils';
import { buildPartZipKey, parseFeatureTypeFromParquetKey, shouldRollPart } from '../../utils/export-utils';
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
 * Background processing pipeline for CSV exports.
 *
 * Called exclusively by the pg-boss job handler
 * (`processDownloadExportJobHandler`). Reads the per-feature-type Parquet
 * artifacts already produced by the parent download pipeline, converts rows to
 * CSV, and rolls them into one or more part-zips whose size is bounded by the
 * per-export `max_part_size_bytes` — a read-side knob so the same download can
 * be re-exported at different part sizes without re-running the expensive
 * Parquet pipeline.
 *
 * Request-time operations (CRUD, auth, presigned URLs) live in
 * `DownloadExportService`.
 *
 * @export
 * @class DownloadExportPipelineService
 * @extends {DBService}
 */
export class DownloadExportPipelineService extends DBService {
  downloadExportRepository: DownloadExportRepository;
  downloadRepository: DownloadRepository;
  artifactService: ArtifactService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadExportRepository = new DownloadExportRepository(connection);
    this.downloadRepository = new DownloadRepository(connection);
    this.artifactService = new ArtifactService(connection);
  }

  /**
   * Validate an export status transition against an allowed current-status set.
   *
   * Pure business-rule assertion; no I/O. Mirrors
   * `DownloadPipelineService.assertDownloadStatusTransition`.
   */
  private assertExportStatusTransition(
    exportId: string,
    currentStatus: DownloadExportRecord['status'],
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[]
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus as DownloadStatusEnum)) {
      throw new ApiConflictError('Invalid download export status transition', [
        'DownloadExportPipelineService->transitionExportStatus',
        { exportId, currentStatus, nextStatus, allowedCurrentStatuses }
      ]);
    }
  }

  /**
   * Transition an export from one of `allowedCurrentStatuses` to `nextStatus`.
   *
   * Fetches the export, asserts the transition is allowed, then writes the new
   * status plus timestamps via `updateDownloadExportStatus`. The state machine
   * lives in the service; the repository stays a thin CRUD wrapper. Illegal
   * transitions (including retries of already-terminal jobs) throw
   * `ApiConflictError` and bubble up to the pg-boss DLQ.
   *
   * `errorMetadata.error` is re-keyed to `error_message` to match the repo's
   * column name while keeping the caller surface consistent with
   * `DownloadPipelineService.transitionDownloadStatus`.
   */
  async transitionExportStatus(
    exportId: string,
    nextStatus: DownloadStatusEnum,
    allowedCurrentStatuses: DownloadStatusEnum[],
    errorMetadata?: { error?: string }
  ): Promise<void> {
    const exportRecord = await this.downloadExportRepository.getDownloadExportById(exportId);

    this.assertExportStatusTransition(exportId, exportRecord.status, nextStatus, allowedCurrentStatuses);

    const now = new Date().toISOString();
    const timestamps: { started_at?: string; completed_at?: string } = {};
    if (nextStatus === DownloadStatusEnum.PROCESSING) {
      timestamps.started_at = now;
    }
    if (nextStatus === DownloadStatusEnum.READY || nextStatus === DownloadStatusEnum.FAILED) {
      timestamps.completed_at = now;
    }

    const errorMessage = errorMetadata?.error === undefined ? {} : { error_message: errorMetadata.error };

    await this.downloadExportRepository.updateDownloadExportStatus(exportId, nextStatus, {
      ...errorMessage,
      ...timestamps
    });
  }

  /**
   * Discover which feature-type Parquet artifacts exist for a download.
   *
   * Parquet keys follow `downloads/{downloadId}/{featureTypeName}/data.parquet`
   * — anything else (including our own part-zip artifacts) is silently skipped
   * via `parseFeatureTypeFromParquetKey` returning null. Deduped because
   * download artifacts can accrete across retries.
   */
  async listExportFeatureTypes(downloadId: string): Promise<string[]> {
    const artifacts = await this.downloadRepository.listDownloadArtifactsByDownloadId(downloadId);

    const featureTypes = new Set<string>();
    for (const artifact of artifacts) {
      const featureType = parseFeatureTypeFromParquetKey(artifact.object_key, downloadId);
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
   * part (64 MB) — bounded regardless of dataset size.
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
    exportId: string;
    downloadId: string;
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
    const { exportId, downloadId, featureTypeName, properties, maxPartSizeBytes, archiverByPart } = params;
    let { currentPart } = params;

    // Reuse the reader + cursor across roll-overs so we don't re-fetch the
    // Parquet footer every time a feature type spans multiple parts.
    const reader = params.resumeReader ?? (await this.openParquetReader(downloadId, featureTypeName));
    const cursor = params.resumeCursor ?? reader.getCursor();

    // submission_feature_id leads so consumers can trace a CSV row back to
    // its feature-detail page in the platform. `uuid` + `parent_uuid` follow
    // as the cross-file star-schema join keys — telemetry → deployment →
    // animal joins downstream by `parent_uuid → uuid`.
    const headers = ['submission_feature_id', 'uuid', 'parent_uuid', ...buildSchemaHeaders(properties)];
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
      const entryName = `biohub-export-${exportId}/${featureTypeName}/chunk${chunkIndex}.csv`;
      const entry = new PassThrough();
      bundle.archive.append(entry, { name: entryName });
      chunksWritten += 1;
      return entry;
    };

    // Write to a PassThrough and respect back-pressure — without the `drain`
    // wait, a slow S3 leg lets the row loop out-run the pipe and the working
    // set silently grows past our bound.
    const writeLine = async (entry: PassThrough, line: string): Promise<void> => {
      if (!entry.write(line)) {
        await once(entry, 'drain');
      }
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
        // (root types like `dataset` have no parent) — emit empty string so
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
  private async openParquetReader(downloadId: string, featureTypeName: string): Promise<ParquetReader> {
    return ParquetReader.openS3(_getS3Client(), {
      Bucket: getObjectStoreBucketName(),
      Key: `downloads/${downloadId}/${featureTypeName}/data.parquet`
    });
  }

  /**
   * Finalize the given part's archiver, record the resulting artifact, and
   * link it to the export via `download_export_artifact`.
   *
   * The S3 key is deterministic (via `buildPartZipKey`) so a retry overwrites
   * the same object; `insertArtifact` is idempotent on
   * `(bucket, object_key)`, and `createDownloadExportArtifact` is idempotent on
   * `(download_export_id, artifact_id)` — a retried part converges to the
   * same DB + S3 state as a first-time success.
   *
   * `chunk_id` on the link row doubles as the 1-based part index for the
   * detail endpoint's `parts[]` ordering.
   */
  async writePartZip(params: {
    exportId: string;
    downloadId: string;
    partIndex: number;
    archive: archiver.Archiver;
    uploadPromise: Promise<void>;
    hashCount: ReturnType<typeof createHashCountStream>;
  }): Promise<{ artifactId: string; byteCount: number }> {
    const { exportId, downloadId, partIndex, archive, uploadPromise, hashCount } = params;

    await archive.finalize();
    await uploadPromise;

    const { sha256Hex, byteCount } = hashCount.getResult();
    const objectKey = buildPartZipKey(downloadId, exportId, partIndex);

    const { artifact_id } = await this.artifactService.insertArtifact({
      bucket: getObjectStoreBucketName(),
      object_key: objectKey,
      byte_size: byteCount,
      artifact_status: ArtifactStatusEnum.UPLOADED,
      checksum_sha256: sha256Hex,
      uploaded_at: new Date().toISOString(),
      format: 'zip'
    });

    await this.downloadExportRepository.createDownloadExportArtifact(exportId, artifact_id, partIndex);

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
   * rejects, which `writePartZip` / `runExport` can observe. Mirrors the
   * legacy pattern in `DownloadPipelineService.processFragment`.
   */
  private createPartArchiverBundle(exportId: string, downloadId: string, partIndex: number): PartArchiverBundle {
    const archive = archiver('zip', { zlib: { level: 5 } });
    const passThrough = new PassThrough();
    const hashCount = createHashCountStream();

    archive.on('error', (err) => {
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);
    passThrough.pipe(hashCount.transform);

    const objectStorageService = new ObjectStorageService();
    const uploadPromise = objectStorageService.uploadStream(
      BucketType.MAIN,
      hashCount.transform,
      'application/zip',
      buildPartZipKey(downloadId, exportId, partIndex)
    );

    return { archive, uploadPromise, passThrough, hashCount, byteCount: 0n };
  }

  /**
   * Orchestrate the CSV export pipeline end-to-end.
   *
   * Sequence:
   *  1. Transition PENDING → PROCESSING (idempotent — re-entering a running
   *     export is allowed so pg-boss retries converge).
   *  2. Resolve the download + per-type schema lookup.
   *  3. For each feature type in order, stream Parquet rows into the current
   *     part's CSV chunks. Roll to a new part once the per-export
   *     `max_part_size_bytes` is crossed.
   *  4. Finalize every open part via `writePartZip`, in index order.
   *  5. Transition PROCESSING → READY.
   *
   * Feature types are processed sequentially, not in parallel, to cap memory:
   * a download with tens of types and hundreds of thousands of rows would
   * otherwise risk OOM in a single pg-boss worker process. Per-type buffering
   * is the bound.
   *
   * Retry-as-lifecycle: errors are NOT caught here. pg-boss records the
   * failure and the DLQ handler owns the FAILED transition — duplicating it
   * would mask the root cause and race the retry path.
   */
  async runExport(exportId: string): Promise<void> {
    await this.transitionExportStatus(exportId, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING,
      DownloadStatusEnum.PROCESSING
    ]);

    const exportRecord = await this.downloadExportRepository.getDownloadExportById(exportId);
    const download = await this.downloadRepository.getDownloadById(exportRecord.download_id);

    const schemaLookup = await this.buildSchemaLookup();
    const featureTypes = await this.listExportFeatureTypes(download.download_id);

    // Fail loud if the parent download has no Parquet artifacts — otherwise the
    // archiver finalizes an empty zip (just the central-directory record) and the
    // user downloads a file their OS refuses to extract. Retry-as-lifecycle: the
    // DLQ handler transitions the export to FAILED after the pg-boss retry budget
    // is exhausted, and the error_message is propagated to the card.
    if (featureTypes.length === 0) {
      throw new Error(
        `Export ${exportId}: parent download ${download.download_id} has no Parquet artifacts to export — refusing to write an empty zip.`
      );
    }

    const maxPartSizeBytes = BigInt(exportRecord.max_part_size_bytes);
    const archiverByPart = new Map<number, PartArchiverBundle>();
    let currentPart = 1;

    archiverByPart.set(currentPart, this.createPartArchiverBundle(exportId, download.download_id, currentPart));

    // Binary file references are collected as rows stream by, grouped by the
    // part index the referring row landed in. Each part's binaries must stream
    // into that part's archiver BEFORE the part is finalized — whether that
    // finalize happens on roll-over (mid-stream, for memory bounds) or at the
    // end. Once a part is finalized its bucket is removed from the map so the
    // working set tracks only still-open parts (mirrors `archiverByPart`),
    // turning the per-part lookup into O(refs-in-this-part) instead of
    // O(all-refs-ever).
    const fileRefsByPart = new Map<number, FileFeatureRef[]>();
    const objectStorageService = new ObjectStorageService();
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
            exportId,
            downloadId: download.download_id,
            featureTypeName,
            properties,
            maxPartSizeBytes,
            archiverByPart,
            currentPart,
            resumeReader: pendingReader,
            resumeCursor: pendingCursor,
            resumeChunkIndex: pendingChunkIndex,
            resumeRow: pendingRow
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
            exportId,
            oldPartIndex,
            objectStorageService
          );
          await this.writePartZip({
            exportId,
            downloadId: download.download_id,
            partIndex: oldPartIndex,
            archive: oldBundle.archive,
            uploadPromise: oldBundle.uploadPromise,
            hashCount: oldBundle.hashCount
          });
          archiverByPart.delete(oldPartIndex);
          fileRefsByPart.delete(oldPartIndex);

          currentPart = result.finalPart;
          archiverByPart.set(currentPart, this.createPartArchiverBundle(exportId, download.download_id, currentPart));
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
          `Export ${exportId}: every feature type resolved to zero rows (${featureTypes.join(
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
          exportId,
          partIndex,
          objectStorageService
        );
        await this.writePartZip({
          exportId,
          downloadId: download.download_id,
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

    await this.transitionExportStatus(exportId, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);
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
    exportId: string,
    partIndex: number,
    objectStorageService: ObjectStorageService
  ): Promise<void> {
    for (const ref of fileRefs) {
      const fileName = ref.filePath.split('/').pop() ?? 'file';
      const entryName = `biohub-export-${exportId}/files${partIndex}/${ref.submissionFeatureId}_${fileName}`;
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
