import mime from 'mime';
import { createHash } from 'node:crypto';
import nodePath from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar-stream';
import { z, ZodError } from 'zod';
import { IngestionValidationError } from '../errors/submission-errors';
import { IFlattenedBlock } from '../models/submission-feature';
import { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';
import { BucketType } from '../services/object-storage/object-storage-service';
import {
  IUploadedMediaFile,
  MediaUploadContext,
  ProcessMediaEntryOptions,
  StreamMediaOptions,
  TarNext,
  UploadMediaEntryOptions
} from './biohub-tar-parser.interface';

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
  parent: z.string().nullable()
});

/**
 * Collect all bytes from a readable stream.
 *
 * @param {Readable} stream - Source stream to buffer.
 * @returns {Promise<Buffer>} Buffer containing all chunks from `stream`.
 */
function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
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
  const path = entryName.substring('files/'.length).replace(/^\/+/, '');
  const fileName = nodePath.basename(path);
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
    checksumSha256
  };

  onUploaded();

  await ingestMediaFile(uploadedFile);
}

/**
 * Handle one tar entry for media ingestion.
 *
 * Non-media entries are drained and skipped. Media entries (`files/*`) are uploaded and
 * `next` is called after upload completion so archive processing stays serialized.
 *
 * @param {{ name?: string | null; type?: string | null; size?: number }} header - Tar entry header.
 * @param {Readable} stream - Tar entry data stream.
 * @param {TarNext} next - Tar continuation callback.
 * @param {(err: unknown) => void} reject - Error callback for entry processing failures.
 * @param {ProcessMediaEntryOptions} options - Upload dependencies and callbacks.
 * @returns {Promise<void>}
 */
async function processMediaEntry(
  header: { name?: string | null; type?: string | null; size?: number },
  stream: Readable,
  next: TarNext,
  reject: (err: unknown) => void,
  options: ProcessMediaEntryOptions
): Promise<void> {
  const { objectStorageService, s3KeyPrefix, ingestMediaFile, onUploaded } = options;
  const resolvedEntryName = resolveScopedEntryName(header.name ?? '', 'files');
  if (!(resolvedEntryName && header.type === 'file')) {
    await drainStream(stream);
    next();
    return;
  }

  const context = buildMediaUploadContext(resolvedEntryName, s3KeyPrefix, header.size ?? 0);

  uploadMediaEntry(stream, context, { objectStorageService, ingestMediaFile, onUploaded }).then(next).catch(reject);
}

/**
 * Stream features from a TAR archive and emit fixed-size flattened batches.
 *
 * Processing rules:
 * - Only `features/*.json` file entries are parsed.
 * - Non-feature entries are drained and ignored so extraction can continue.
 * - Each parsed entry may be a single object or an array of objects.
 * - Objects are validated against `IFlattenedBlock` shape (shallow validation only).
 * - Valid objects are buffered into `batchSize` chunks and sent to `ingestFeatureBatch`.
 *
 * Error behavior:
 * - Invalid JSON rejects the stream.
 * - Schema validation rejects with `IngestionValidationError`.
 * - Any error thrown by `ingestFeatureBatch` rejects the stream.
 *
 * Usage contract:
 * - Caller is responsible for transactional behavior and persistence inside `ingestFeatureBatch`.
 * - `batchSize` should be > 0; very small values increase callback overhead.
 *
 * @param {Readable} inputStream - Tar archive stream.
 * @param {number} batchSize - Max features per callback invocation.
 * @param {(blocks: IFlattenedBlock[]) => Promise<void>} ingestFeatureBatch - Async sink for parsed feature batches.
 * @returns {Promise<{ featureCount: number }>} Count of parsed feature objects.
 * @throws {Error} When JSON parsing, shallow validation, or callback processing fails.
 */
export async function streamFeatures(
  inputStream: Readable,
  batchSize: number,
  ingestFeatureBatch: (blocks: IFlattenedBlock[]) => Promise<void>
): Promise<{ featureCount: number }> {
  if (batchSize < 1) {
    throw new Error('batchSize must be greater than 0');
  }

  const extract = tar.extract();
  let featureCount = 0;
  let pendingBlocks: IFlattenedBlock[] = [];

  /**
   * Flush buffered feature blocks through the caller callback.
   */
  const flushPending = async (): Promise<void> => {
    if (!pendingBlocks.length) {
      return;
    }

    const currentBlocks = pendingBlocks;
    pendingBlocks = [];
    await ingestFeatureBatch(currentBlocks);
  };

  let rejectEntryPromise: (err: unknown) => void;
  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', async (header, stream, next) => {
      try {
        if (header.type === 'directory') {
          await drainStream(stream);
          next();
          return;
        }

        const resolvedEntryName = resolveScopedEntryName(header.name ?? '', 'features');
        if (!(resolvedEntryName && resolvedEntryName.endsWith('.json') && header.type === 'file')) {
          await drainStream(stream);
          next();
          return;
        }

        const buffer = await streamToBuffer(stream);
        const parsed = JSON.parse(buffer.toString('utf-8')) as unknown;
        const parsedEntries = Array.isArray(parsed) ? parsed : [parsed];

        for (const parsedEntry of parsedEntries) {
          const block = extractFeatureFromTarballEntry(parsedEntry, resolvedEntryName);
          pendingBlocks.push(block);
          featureCount += 1;

          if (pendingBlocks.length >= batchSize) {
            await flushPending();
          }
        }

        next();
      } catch (error) {
        reject(error);
      }
    });

    extract.on('finish', async () => {
      try {
        await flushPending();
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
  return { featureCount };
}

/**
 * Stream codesets from a TAR archive and emit each parsed file payload.
 *
 * Processing rules:
 * - Only `codes/*.json` file entries are parsed.
 * - Each codes file is parsed and validated independently.
 * - Non-codes entries are drained and ignored.
 *
 * Error behavior:
 * - Invalid JSON rejects the stream.
 * - Schema validation rejects with `IngestionValidationError`.
 * - Any error thrown by `ingestCodesets` rejects the stream.
 *
 * Usage contract:
 * - Caller handles persistence/merge strategy for each parsed codes payload.
 *
 * @param {Readable} inputStream - Tar archive stream.
 * @param {(codesets: TarCodesets) => Promise<void>} ingestCodesets - Async sink for each parsed codeset file.
 * @returns {Promise<void>}
 * @throws {Error} When JSON parsing, validation, or callback processing fails.
 */
export async function streamCodesets(
  inputStream: Readable,
  ingestCodesets: (codesets: TarCodesets) => Promise<void>
): Promise<void> {
  const extract = tar.extract();

  let rejectEntryPromise: (err: unknown) => void;
  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', async (header, stream, next) => {
      try {
        if (header.type === 'directory') {
          await drainStream(stream);
          next();
          return;
        }

        const resolvedEntryName = resolveScopedEntryName(header.name ?? '', 'codes');
        if (!(resolvedEntryName && resolvedEntryName.endsWith('.json') && header.type === 'file')) {
          await drainStream(stream);
          next();
          return;
        }

        const buffer = await streamToBuffer(stream);
        const parsed = JSON.parse(buffer.toString('utf-8')) as unknown;
        const codesets = extractCodesetsFromTarballEntry(parsed, resolvedEntryName);

        await ingestCodesets(codesets);
        next();
      } catch (error) {
        reject(error);
      }
    });

    extract.on('finish', resolve);
    extract.on('error', reject);
  });

  pipeline(inputStream, extract).catch((error) => {
    rejectEntryPromise(error);
  });

  await entryPromise;
}

/**
 * Stream media files from a TAR archive to object storage.
 * Non-media entries are skipped.
 *
 * Processing rules:
 * - Only `files/*` file entries are uploaded.
 * - Uploads are intentionally serialized (one active upload at a time).
 * - SHA-256 is computed while streaming to storage (no duplicate full buffering).
 * - Relative archive path under `files/` is preserved in the stored object key.
 *
 * For each uploaded file, metadata is generated:
 * - `fileName`: basename of the archive path
 * - `path`: archive-relative path under `files/`
 * - `s3Key`: `${s3KeyPrefix}/${path}`
 * - `byteSize`: tar header size
 * - `checksumSha256`: streaming digest of uploaded bytes
 *
 * Error behavior:
 * - Upload failures reject the stream.
 * - Any error thrown by `ingestMediaBatch` rejects the stream.
 *
 * @param {Readable} inputStream - Tar archive stream.
 * @param {StreamMediaOptions} options - Media stream dependencies and batching thresholds.
 * @returns {Promise<{ uploadedCount: number }>} Count of uploaded media files.
 * @throws {Error} When stream processing, upload, or callback processing fails.
 */
export async function streamMedia(
  inputStream: Readable,
  options: StreamMediaOptions
): Promise<{ uploadedCount: number }> {
  const { objectStorageService, s3KeyPrefix, batchSize, maxBatchBytes, ingestMediaBatch } = options;

  if (batchSize < 1) {
    throw new Error('batchSize must be greater than 0');
  }
  if (maxBatchBytes < 1) {
    throw new Error('maxBatchBytes must be greater than 0');
  }

  const extract = tar.extract();
  let uploadedCount = 0;
  let pendingUploadedFiles: IUploadedMediaFile[] = [];
  let pendingUploadedBytes = 0;

  const onUploaded = (): void => {
    uploadedCount += 1;
  };

  const shouldFlush = (): boolean => {
    return pendingUploadedFiles.length >= batchSize || pendingUploadedBytes >= maxBatchBytes;
  };

  /**
   * Flush buffered uploaded media records through the caller callback.
   */
  const flushPending = async (): Promise<void> => {
    if (!pendingUploadedFiles.length) {
      return;
    }

    const currentBatch = pendingUploadedFiles;
    pendingUploadedFiles = [];
    pendingUploadedBytes = 0;
    await ingestMediaBatch(currentBatch);
  };

  /**
   * Queue one uploaded media file and flush when thresholds are reached.
   *
   * @param {IUploadedMediaFile} uploadedFile
   * @returns {Promise<void>}
   */
  const ingestMediaFile = async (uploadedFile: IUploadedMediaFile): Promise<void> => {
    pendingUploadedFiles.push(uploadedFile);
    pendingUploadedBytes += uploadedFile.byteSize;

    if (shouldFlush()) {
      await flushPending();
    }
  };

  let rejectEntryPromise: (err: unknown) => void;

  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', async (header, stream, next) => {
      try {
        await processMediaEntry(header, stream, next, reject, {
          objectStorageService,
          s3KeyPrefix,
          ingestMediaFile,
          onUploaded
        });
      } catch (err) {
        reject(err);
      }
    });

    extract.on('finish', async () => {
      try {
        await flushPending();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    extract.on('error', reject);
  });

  // Pipe input into the tar extractor. Forward pipeline errors to the entry
  // promise — if inputStream fails before any entries are emitted, the extract
  // 'error' event may not fire and entryPromise would hang indefinitely.
  pipeline(inputStream, extract).catch((err) => {
    rejectEntryPromise(err);
  });

  await entryPromise;

  return { uploadedCount };
}
