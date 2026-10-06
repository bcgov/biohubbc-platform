import mime from 'mime';
import { createHash } from 'node:crypto';
import nodePath from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar-stream';
import { z, ZodError } from 'zod';
import { UPLOAD_ARCHIVE_JSON_FILE_MAX_BYTES } from '../constants/upload';
import { IngestionValidationError } from '../errors/submission-errors';
import { IFlattenedBlock } from '../models/submission-feature';
import { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';
import { BucketType } from '../services/object-storage/object-storage-service';
import {
  IUploadedMediaFile,
  MediaUploadContext,
  StreamSubmissionArchiveOptions,
  TarEntryHeader,
  TarNext,
  UploadMediaEntryOptions
} from './biohub-tar-parser.interface';
import { getLogger } from './logger';

/**
 * TAR ingestion helpers for submission archives.
 *
 * Expected logical archive layout after optional SIMS prefix stripping:
 * - `features/*.json` => feature payloads (`IFlattenedBlock` entries)
 * - `codes/*.json` => contributor codeset payloads (`TarCodesets`)
 * - `files/*` => binary media uploaded to object storage
 *
 * Design notes:
 * - Streaming-first: entries are consumed as they arrive (no full archive buffering).
 * - Strict folder scoping: only recognized folders are processed; everything else is ignored.
 * - Fail-fast: malformed JSON, schema errors, or callback failures reject the stream.
 * - Callback-driven orchestration: persistence is delegated to caller-provided async handlers.
 */
const FlattenedFeatureSchema: z.ZodType<IFlattenedBlock> = z.object({
  id: z.string().min(1, 'Feature entry is missing required string field: id'),
  type: z.string().min(1, 'Feature entry is missing required string field: type'),
  properties: z.record(z.unknown()),
  content: z.array(z.string()),
  parent: z.string().nullable(),
  universal_id: z.string().min(1).max(200).optional()
});
const defaultLog = getLogger('utils/biohub-tar-parser');

/**
 * Collect all bytes from a readable stream with a strict max byte cap.
 *
 * @param {Readable} stream - Source stream to buffer.
 * @param {number} maxBytes - Maximum bytes allowed before rejecting.
 * @param {string} entryName - Entry name used for stable error context.
 * @param {number} [expectedBytes] - Optional tar header size; when provided, a fixed
 * buffer is allocated up-front to avoid a temporary `Buffer.concat` copy.
 * @returns {Promise<Buffer>} Buffer containing all chunks from `stream`.
 */
function streamToBuffer(
  stream: Readable,
  maxBytes: number,
  entryName: string,
  expectedBytes?: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const hasExpectedSize =
      typeof expectedBytes === 'number' &&
      Number.isFinite(expectedBytes) &&
      expectedBytes >= 0 &&
      expectedBytes <= maxBytes;
    const fixedBuffer = hasExpectedSize ? Buffer.allocUnsafe(expectedBytes) : undefined;
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let fixedBufferOffset = 0;
    let settled = false;

    // Guard against duplicate resolve/reject paths (e.g., manual destroy + error event).
    const fail = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    stream.on('data', (chunk: Buffer | string) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += chunkBuffer.byteLength;

      if (totalBytes > maxBytes) {
        const error = new IngestionValidationError(
          `Archive JSON entry exceeds max size: entry=${entryName}; maxBytes=${maxBytes}`
        );
        fail(error);
        stream.destroy(error);
        return;
      }

      if (fixedBuffer) {
        if (fixedBufferOffset + chunkBuffer.byteLength > fixedBuffer.byteLength) {
          const error = new IngestionValidationError(
            `Archive JSON entry size mismatch: entry=${entryName}; entrySizeBytes=${
              fixedBuffer.byteLength
            }; streamedBytes=${fixedBufferOffset + chunkBuffer.byteLength}`
          );
          fail(error);
          stream.destroy(error);
          return;
        }

        chunkBuffer.copy(fixedBuffer, fixedBufferOffset);
        fixedBufferOffset += chunkBuffer.byteLength;
        return;
      }

      chunks.push(chunkBuffer);
    });

    stream.on('end', () => {
      if (settled) {
        return;
      }
      settled = true;

      if (fixedBuffer) {
        resolve(fixedBuffer.subarray(0, fixedBufferOffset));
        return;
      }

      resolve(Buffer.concat(chunks));
    });
    stream.on('error', fail);
  });
}

/**
 * Fail fast when tar header advertises JSON entry size above configured cap.
 *
 * @param {number | undefined} entrySizeBytes - Declared tar header size in bytes.
 * @param {string} entryName - Entry name used for stable error context.
 * @param {number} maxBytes - Maximum bytes allowed.
 */
function assertEntrySizeWithinLimit(entrySizeBytes: number | undefined, entryName: string, maxBytes: number): void {
  if (typeof entrySizeBytes === 'number' && Number.isFinite(entrySizeBytes) && entrySizeBytes > maxBytes) {
    throw new IngestionValidationError(
      `Archive JSON entry exceeds max size: entry=${entryName}; entrySizeBytes=${entrySizeBytes}; maxBytes=${maxBytes}`
    );
  }
}

/**
 * Parse one JSON tar entry with hard byte limits.
 *
 * Enforces two guards:
 * - header-level check (`entrySizeBytes`) when available
 * - streamed-byte check during buffering
 *
 * @param {Readable} stream - Tar entry stream.
 * @param {string} entryName - Entry name used for stable error context.
 * @param {number} entrySizeBytes - Tar header declared byte size.
 * @returns {Promise<{ parsed: unknown; byteLength: number }>} Parsed payload and buffered byte length.
 */
async function parseJsonArchiveEntry(
  stream: Readable,
  entryName: string,
  entrySizeBytes?: number
): Promise<{ parsed: unknown; byteLength: number }> {
  assertEntrySizeWithinLimit(entrySizeBytes, entryName, UPLOAD_ARCHIVE_JSON_FILE_MAX_BYTES);
  const buffer = await streamToBuffer(stream, UPLOAD_ARCHIVE_JSON_FILE_MAX_BYTES, entryName, entrySizeBytes);
  return {
    parsed: JSON.parse(buffer.toString('utf-8')) as unknown,
    byteLength: buffer.byteLength
  };
}

/**
 * Normalize a tar entry name for stable folder matching.
 *
 * Normalization rules:
 * - convert backslashes to forward slashes
 * - strip leading "./" segments
 * - collapse duplicate slashes
 *
 * @param {string} entryName
 * @returns {string}
 */
function normalizeEntryName(entryName: string): string {
  return entryName
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/{2,}/g, '/');
}

/**
 * Drain a stream without buffering its content.
 *
 * Used for tar entries we intentionally skip so the extractor can continue.
 *
 * @param {Readable} stream - Source stream to consume.
 * @returns {Promise<void>}
 */
function drainStream(stream: Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
    stream.resume();
  });
}

/**
 * Build a compact, readable message from zod issues.
 *
 * @param {ZodError} error
 * @returns {string}
 */
function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Parse and shallow-validate one codeset JSON entry.
 *
 * Expected JSON shape is an object where each top-level key is a codeset key.
 * Validation errors are normalized to a stable ingestion error message.
 *
 * @param {unknown} value - Parsed JSON payload from a `codes/*.json` file.
 * @param {string} entryName - Tar entry path for context.
 * @returns {TarCodesets}
 * @throws {IngestionValidationError} When payload shape does not satisfy `TarCodesets`.
 */
function extractCodesetsFromTarballEntry(value: unknown, entryName: string): TarCodesets {
  try {
    return TarCodesets.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new IngestionValidationError(
        `Codeset entry failed shallow validation: entry=${entryName}; issues=${formatZodIssues(error)}`
      );
    }

    throw error;
  }
}

/**
 * Parse and shallow-validate one feature JSON object.
 *
 * Validation behavior:
 * - requires `id`, `type`, `properties`, `content`, and `parent`
 * - validates payload shape without remapping fields
 *
 * @param {unknown} value - Parsed JSON object for a single feature.
 * @param {string} entryName - Tar entry path for context.
 * @returns {IFlattenedBlock}
 * @throws {IngestionValidationError} When required fields are missing or incorrectly typed.
 */
function extractFeatureFromTarballEntry(value: unknown, entryName: string): IFlattenedBlock {
  try {
    return FlattenedFeatureSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new IngestionValidationError(
        `Feature entry failed shallow validation: entry=${entryName}; issues=${formatZodIssues(error)}`
      );
    }

    throw error;
  }
}

/**
 * Build derived upload metadata for a media tar entry.
 *
 * @param {string} entryName - Normalized tar entry path (expected under `files/`).
 * @param {string} s3KeyPrefix - Prefix prepended to object storage keys.
 * @param {number} byteSize - Entry byte size from the tar header.
 * @returns {MediaUploadContext} Context used to upload and persist media metadata.
 */
function buildMediaUploadContext(entryName: string, s3KeyPrefix: string, byteSize: number): MediaUploadContext {
  const path = entryName;
  const fileName = nodePath.basename(entryName);
  const s3Key = `${s3KeyPrefix}/${path}`;

  return {
    path,
    fileName,
    s3Key,
    mimetype: mime.getType(fileName) ?? 'application/octet-stream',
    byteSize
  };
}

/**
 * Resolve a tar entry path to a canonical scoped path rooted at `<scope>/`.
 *
 * Accepts either:
 * - `<scope>/...`
 * - `<any-prefix>/<scope>/...` (for archives wrapped in a root directory)
 *
 * Returns `null` when the entry is not under the requested scope.
 *
 * @param {string} entryName
 * @param {'features' | 'codes' | 'files'} scope - Top-level archive folder to match.
 * @returns {string | null}
 */
function resolveScopedEntryName(entryName: string, scope: 'features' | 'codes' | 'files'): string | null {
  const normalizedEntryName = normalizeEntryName(entryName);
  const scopePrefix = `${scope}/`;
  if (normalizedEntryName.startsWith(scopePrefix)) {
    return normalizedEntryName;
  }

  const nestedScopeIndex = normalizedEntryName.indexOf(`/${scopePrefix}`);
  if (nestedScopeIndex === -1) {
    return null;
  }

  return normalizedEntryName.substring(nestedScopeIndex + 1);
}

/**
 * Create a pass-through transform that updates a running checksum per chunk.
 *
 * @param {ReturnType<typeof createHash>} checksum - Mutable hash state.
 * @returns {Transform} Transform stream that forwards chunks unchanged.
 */
function createChecksumTransform(checksum: ReturnType<typeof createHash>): Transform {
  return new Transform({
    transform(chunk, _encoding, callback) {
      checksum.update(chunk as Buffer);
      callback(null, chunk);
    }
  });
}

/**
 * Resolve with a hex digest when the checksum stream completes.
 *
 * @param {Transform} checksumStream - Stream producing checksum updates.
 * @param {ReturnType<typeof createHash>} checksum - Hash state finalized on stream finish.
 * @returns {Promise<string>} SHA-256 digest in hex format.
 */
function waitForChecksum(checksumStream: Transform, checksum: ReturnType<typeof createHash>): Promise<string> {
  return new Promise((resolve, reject) => {
    checksumStream.on('finish', () => resolve(checksum.digest('hex')));
    checksumStream.on('error', reject);
  });
}

/**
 * Upload a single media entry to object storage while computing checksum metadata.
 *
 * @param {Readable} stream - Tar entry stream.
 * @param {MediaUploadContext} context - Derived upload and metadata fields.
 * @param {UploadMediaEntryOptions} options - Storage dependency and post-upload callbacks.
 * @returns {Promise<void>}
 */
async function uploadMediaEntry(
  stream: Readable,
  context: MediaUploadContext,
  options: UploadMediaEntryOptions
): Promise<void> {
  const { objectStorageService, ingestMediaFile, onUploaded } = options;
  const checksum = createHash('sha256');
  const passThrough = new PassThrough();
  const checksumStream = createChecksumTransform(checksum);
  const checksumReady = waitForChecksum(checksumStream, checksum);

  const uploadPromise = objectStorageService.uploadStream(
    BucketType.MAIN,
    passThrough,
    context.mimetype,
    context.s3Key
  );

  stream.pipe(checksumStream).pipe(passThrough);
  await uploadPromise;

  const checksumSha256 = await checksumReady;
  const uploadedFile: IUploadedMediaFile = {
    fileName: context.fileName,
    s3Key: context.s3Key,
    path: context.path,
    byteSize: context.byteSize,
    checksumSha256,
    mimetype: context.mimetype
  };

  onUploaded();

  await ingestMediaFile(uploadedFile);
}

/**
 * Attempt to process one `features/*.json` tar entry.
 *
 * Behavior:
 * - Returns `false` when the entry is outside `features/`, not JSON, or not a file.
 * - Buffers and parses JSON payloads for matching entries.
 * - Accepts either one object or an array payload and forwards each item through
 *   `ingestFeatureEntry` so caller-owned batching/validation rules stay centralized.
 * - Computes a per-item byte estimate from the buffered JSON payload and forwards
 *   it so callers can enforce byte-based batch flush thresholds.
 * - Returns `true` once the entry has been fully consumed and processed.
 *
 * @param {TarEntryHeader} header Tar entry header.
 * @param {Readable} stream Tar entry data stream.
 * @param {{
 *   ingestFeatureEntry: (entryValue: unknown, entryName: string, entryBytesEstimate: number) => Promise<void>;
 * }} options
 * Feature processing callback and dependencies.
 * @returns {Promise<boolean>} True when the entry matched and was handled.
 */
async function processFeatureArchiveEntry(
  header: TarEntryHeader,
  stream: Readable,
  options: {
    ingestFeatureEntry: (entryValue: unknown, entryName: string, entryBytesEstimate: number) => Promise<void>;
  }
): Promise<boolean> {
  const resolvedFeatureEntryName = resolveScopedEntryName(header.name ?? '', 'features');
  if (!(resolvedFeatureEntryName && resolvedFeatureEntryName.endsWith('.json') && header.type === 'file')) {
    return false;
  }

  const parsedJson = await parseJsonArchiveEntry(stream, resolvedFeatureEntryName, header.size);
  const parsedEntries = Array.isArray(parsedJson.parsed) ? parsedJson.parsed : [parsedJson.parsed];
  const entryBytesEstimate = Math.max(1, Math.ceil(parsedJson.byteLength / parsedEntries.length));

  for (const parsedEntry of parsedEntries) {
    await options.ingestFeatureEntry(parsedEntry, resolvedFeatureEntryName, entryBytesEstimate);
  }

  return true;
}

/**
 * Attempt to process one `codes/*.json` tar entry.
 *
 * Behavior:
 * - Returns `false` when the entry is outside `codes/`, not JSON, or not a file.
 * - Buffers and parses the JSON payload.
 * - Validates/transforms through `extractCodesetsFromTarballEntry`.
 * - Persists via `ingestCodesets` and increments caller-owned counters.
 *
 * @param {{ name?: string | null; type?: string | null; size?: number }} header Tar entry header.
 * @param {Readable} stream Tar entry data stream.
 * @param {{
 *   ingestCodesets: (codesets: TarCodesets) => Promise<void>;
 *   onCodesetFileParsed: () => void;
 * }} options Codeset sink and side-effect callback.
 * @returns {Promise<boolean>} True when the entry matched and was handled.
 */
async function processCodesArchiveEntry(
  header: TarEntryHeader,
  stream: Readable,
  options: {
    ingestCodesets: (codesets: TarCodesets) => Promise<void>;
    onCodesetFileParsed: () => void;
  }
): Promise<boolean> {
  const resolvedCodesEntryName = resolveScopedEntryName(header.name ?? '', 'codes');
  if (!(resolvedCodesEntryName && resolvedCodesEntryName.endsWith('.json') && header.type === 'file')) {
    return false;
  }

  const parsedJson = await parseJsonArchiveEntry(stream, resolvedCodesEntryName, header.size);
  const codesets = extractCodesetsFromTarballEntry(parsedJson.parsed, resolvedCodesEntryName);
  await options.ingestCodesets(codesets);
  options.onCodesetFileParsed();
  return true;
}

/**
 * Attempt to process one `files/*` media entry with bounded concurrency.
 *
 * Behavior:
 * - Returns `false` for non-media entries.
 * - Starts upload immediately for matched entries and tracks the promise in
 *   `inFlightMediaUploads` for lifecycle management.
 * - Applies backpressure via `Promise.race` when in-flight uploads reach the
 *   configured concurrency ceiling.
 *
 * @param {{ name?: string | null; type?: string | null; size?: number }} header Tar entry header.
 * @param {Readable} stream Tar entry data stream.
 * @param {(err: unknown) => void} reject Error callback for async upload failures.
 * @param {{
 *   objectStorageService: StreamSubmissionArchiveOptions['objectStorageService'];
 *   s3KeyPrefix: string;
 *   ingestMediaFile: (uploadedFile: IUploadedMediaFile) => Promise<void>;
 *   onUploaded: () => void;
 *   mediaConcurrency: number;
 *   inFlightMediaUploads: Set<Promise<void>>;
 * }} options Media upload dependencies and tracking state.
 * @returns {Promise<boolean>} True when the entry matched and upload was started.
 */
async function processConcurrentMediaArchiveEntry(
  header: TarEntryHeader,
  stream: Readable,
  reject: (err: unknown) => void,
  options: {
    objectStorageService: StreamSubmissionArchiveOptions['objectStorageService'];
    s3KeyPrefix: string;
    ingestMediaFile: (uploadedFile: IUploadedMediaFile) => Promise<void>;
    onUploaded: () => void;
    mediaConcurrency: number;
    inFlightMediaUploads: Set<Promise<void>>;
  }
): Promise<boolean> {
  // GNU sparse entries may expose an internal header name while preserving the archive path in PAX metadata.
  const entryName = header.pax?.['GNU.sparse.name'] || header.name || '';
  const resolvedMediaEntryName = resolveScopedEntryName(entryName, 'files');
  if (!(resolvedMediaEntryName && header.type === 'file')) {
    return false;
  }

  const context = buildMediaUploadContext(resolvedMediaEntryName, options.s3KeyPrefix, header.size ?? 0);
  const uploadPromise = uploadMediaEntry(stream, context, {
    objectStorageService: options.objectStorageService,
    ingestMediaFile: options.ingestMediaFile,
    onUploaded: options.onUploaded
  });

  options.inFlightMediaUploads.add(uploadPromise);
  uploadPromise.finally(() => options.inFlightMediaUploads.delete(uploadPromise)).catch(reject);

  if (options.inFlightMediaUploads.size >= options.mediaConcurrency) {
    await Promise.race(options.inFlightMediaUploads);
  }

  return true;
}

/**
 * Route one tar entry through feature, codeset, and media handlers.
 *
 * Processing order is intentional:
 * 1. Directories are drained and skipped.
 * 2. Feature JSON entries are processed first.
 * 3. Codeset JSON entries are processed second.
 * 4. Media file entries are uploaded last with concurrency bounds.
 * 5. Everything else is drained and ignored.
 *
 * This function is responsible for always calling `next()` exactly once per entry.
 *
 * @param {{ name?: string | null; type?: string | null; size?: number }} header Tar entry header.
 * @param {Readable} stream Tar entry data stream.
 * @param {TarNext} next Tar continuation callback.
 * @param {(err: unknown) => void} reject Error callback for asynchronous failures.
 * @param {{
 *   ingestFeatureEntry: (entryValue: unknown, entryName: string, entryBytesEstimate: number) => Promise<void>;
 *   ingestCodesets: (codesets: TarCodesets) => Promise<void>;
 *   onCodesetFileParsed: () => void;
 *   objectStorageService: StreamSubmissionArchiveOptions['objectStorageService'];
 *   s3KeyPrefix: string;
 *   ingestMediaFile: (uploadedFile: IUploadedMediaFile) => Promise<void>;
 *   onUploaded: () => void;
 *   mediaConcurrency: number;
 *   inFlightMediaUploads: Set<Promise<void>>;
 * }} options Entry handlers and shared processing state.
 * @returns {Promise<void>}
 */
async function processSubmissionArchiveEntry(
  header: TarEntryHeader,
  stream: Readable,
  next: TarNext,
  reject: (err: unknown) => void,
  options: {
    ingestFeatureEntry: (entryValue: unknown, entryName: string, entryBytesEstimate: number) => Promise<void>;
    ingestCodesets: (codesets: TarCodesets) => Promise<void>;
    onCodesetFileParsed: () => void;
    objectStorageService: StreamSubmissionArchiveOptions['objectStorageService'];
    s3KeyPrefix: string;
    ingestMediaFile: (uploadedFile: IUploadedMediaFile) => Promise<void>;
    onUploaded: () => void;
    mediaConcurrency: number;
    inFlightMediaUploads: Set<Promise<void>>;
  }
): Promise<void> {
  if (header.type === 'directory') {
    await drainStream(stream);
    next();
    return;
  }

  if (
    await processFeatureArchiveEntry(header, stream, {
      ingestFeatureEntry: options.ingestFeatureEntry
    })
  ) {
    next();
    return;
  }

  if (
    await processCodesArchiveEntry(header, stream, {
      ingestCodesets: options.ingestCodesets,
      onCodesetFileParsed: options.onCodesetFileParsed
    })
  ) {
    next();
    return;
  }

  if (
    await processConcurrentMediaArchiveEntry(header, stream, reject, {
      objectStorageService: options.objectStorageService,
      s3KeyPrefix: options.s3KeyPrefix,
      ingestMediaFile: options.ingestMediaFile,
      onUploaded: options.onUploaded,
      mediaConcurrency: options.mediaConcurrency,
      inFlightMediaUploads: options.inFlightMediaUploads
    })
  ) {
    next();
    return;
  }

  await drainStream(stream);
  next();
}

/**
 * Stream a submission archive once and persist media, codesets, and features.
 *
 * Processing rules:
 * - `features/*.json` are parsed and batched to `ingestFeatureBatch`.
 *   Batching is bounded by both `featureBatchSize` and `featureMaxBatchBytes`.
 * - `codes/*.json` are parsed and sent to `ingestCodesets`.
 * - `files/*` entries are streamed to object storage and batched to `ingestMediaBatch`.
 * - Function resolves only after all in-flight media uploads complete and all
 *   pending feature/media batches have been flushed.
 *
 * @param {Readable} inputStream
 * @param {StreamSubmissionArchiveOptions} options
 * @returns {Promise<{ featureCount: number; uploadedCount: number; codesetFileCount: number }>}
 */
export async function streamSubmissionArchive(
  inputStream: Readable,
  options: StreamSubmissionArchiveOptions
): Promise<{ featureCount: number; uploadedCount: number; codesetFileCount: number }> {
  const {
    objectStorageService,
    s3KeyPrefix,
    featureBatchSize,
    featureMaxBatchBytes,
    mediaBatchSize,
    mediaMaxBatchBytes,
    mediaConcurrency,
    ingestFeatureBatch,
    ingestCodesets,
    ingestMediaBatch
  } = options;

  if (featureBatchSize < 1) {
    throw new Error('featureBatchSize must be greater than 0');
  }
  if (featureMaxBatchBytes < 1) {
    throw new Error('featureMaxBatchBytes must be greater than 0');
  }
  if (mediaBatchSize < 1) {
    throw new Error('mediaBatchSize must be greater than 0');
  }
  if (mediaMaxBatchBytes < 1) {
    throw new Error('mediaMaxBatchBytes must be greater than 0');
  }
  if (mediaConcurrency < 1) {
    throw new Error('mediaConcurrency must be greater than 0');
  }

  const extract = tar.extract();

  let featureCount = 0;
  let uploadedCount = 0;
  let codesetFileCount = 0;
  let mediaStateQueue: Promise<void> = Promise.resolve();
  let pendingFeatureBlocks: IFlattenedBlock[] = [];
  // Byte estimate (derived from parsed JSON payload size) used to bound feature
  // batch memory in addition to feature count.
  let pendingFeatureBytes = 0;
  let pendingUploadedFiles: IUploadedMediaFile[] = [];
  let pendingUploadedBytes = 0;
  const inFlightMediaUploads = new Set<Promise<void>>();

  /**
   * Flush buffered feature blocks to caller persistence callback.
   */
  const flushPendingFeatures = async (): Promise<void> => {
    if (!pendingFeatureBlocks.length) {
      return;
    }

    const currentBlocks = pendingFeatureBlocks;
    pendingFeatureBlocks = [];
    pendingFeatureBytes = 0;
    await ingestFeatureBatch(currentBlocks);
  };

  /**
   * Flush buffered media metadata rows to caller persistence callback.
   */
  const flushPendingMedia = async (): Promise<void> => {
    const hasPendingMedia = pendingUploadedFiles.length > 0;
    if (!hasPendingMedia) {
      return;
    }

    const currentBatch = pendingUploadedFiles.splice(0, pendingUploadedFiles.length);
    pendingUploadedBytes = 0;
    await ingestMediaBatch(currentBatch);
  };

  /**
   * Serialize media metadata buffering and threshold-based flushes.
   *
   * Upload completion callbacks may resolve concurrently; this queue ensures
   * shared mutable state (`pendingUploadedFiles`, `pendingUploadedBytes`) is
   * mutated in one logical write stream.
   */
  const enqueueUploadedMediaFile = (uploadedFile: IUploadedMediaFile): Promise<void> => {
    const nextWrite = mediaStateQueue.then(async () => {
      pendingUploadedFiles.push(uploadedFile);
      pendingUploadedBytes += uploadedFile.byteSize;

      if (pendingUploadedFiles.length >= mediaBatchSize || pendingUploadedBytes >= mediaMaxBatchBytes) {
        await flushPendingMedia();
      }
    });

    mediaStateQueue = nextWrite.then(
      () => undefined,
      () => undefined
    );

    return nextWrite;
  };

  let rejectEntryPromise: (err: unknown) => void;
  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', (header, stream, next) => {
      processSubmissionArchiveEntry(header, stream, next, reject, {
        ingestFeatureEntry: async (entryValue, entryName, entryBytesEstimate) => {
          const block = extractFeatureFromTarballEntry(entryValue, entryName);
          pendingFeatureBlocks.push(block);
          // Estimate, not exact retained heap size; sufficient for consistent flush gating.
          pendingFeatureBytes += entryBytesEstimate;
          featureCount += 1;
          if (pendingFeatureBlocks.length >= featureBatchSize || pendingFeatureBytes >= featureMaxBatchBytes) {
            await flushPendingFeatures();
          }
        },
        ingestCodesets,
        onCodesetFileParsed: () => {
          codesetFileCount += 1;
        },
        objectStorageService,
        s3KeyPrefix,
        ingestMediaFile: enqueueUploadedMediaFile,
        onUploaded: () => {
          uploadedCount += 1;
        },
        mediaConcurrency,
        inFlightMediaUploads
      }).catch(reject);
    });

    extract.on('finish', async () => {
      try {
        // Wait for uploads and serialized media queue before final flushes so no
        // late-arriving media rows are dropped.
        await Promise.all(inFlightMediaUploads);
        await mediaStateQueue;
        await flushPendingFeatures();
        await flushPendingMedia();
        defaultLog.debug({
          label: 'streamSubmissionArchive',
          message: 'Completed archive stream',
          uploadedCount,
          featureCount,
          codesetFileCount
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    extract.on('error', reject);
  });

  pipeline(inputStream, extract).catch((error) => {
    rejectEntryPromise(error);
  });

  await entryPromise;

  return { featureCount, uploadedCount, codesetFileCount };
}
