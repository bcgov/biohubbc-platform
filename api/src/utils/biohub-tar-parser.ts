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
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { IUploadedMediaFile } from './biohub-tar-parser.interface';

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
 * Strip the optional archive directory prefix added by SIMS.
 * Real SIMS archives wrap all entries under a UUID directory, e.g.:
 *   `6b916891-22d5-4c63-a972-33261b1f7c6b/.dataset-id`
 *   `6b916891-22d5-4c63-a972-33261b1f7c6b/dataset.json`
 *   `6b916891-22d5-4c63-a972-33261b1f7c6b/files/photo.jpg`
 *
 * This normalizes entry names so the parser works with both flat and prefixed archives.
 *
 * @param {string} entryName
 * @returns {string} Entry name without the archive root folder prefix.
 */
function stripArchivePrefix(entryName: string): string {
  const slashIndex = entryName.indexOf('/');
  if (slashIndex === -1) {
    return entryName;
  }

  const firstSegment = entryName.substring(0, slashIndex);
  if (firstSegment === 'files') {
    return entryName;
  }

  return entryName.substring(slashIndex + 1);
}

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
  const extract = tar.extract();
  let featureCount = 0;
  let pendingBlocks: IFlattenedBlock[] = [];

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

        const entryName = stripArchivePrefix(header.name);
        const isFeatureJson = entryName.startsWith('features/') && entryName.endsWith('.json');

        if (!isFeatureJson) {
          await drainStream(stream);
          next();
          return;
        }

        const buffer = await streamToBuffer(stream);
        const parsed = JSON.parse(buffer.toString('utf-8')) as unknown;
        const parsedEntries = Array.isArray(parsed) ? parsed : [parsed];

        for (const parsedEntry of parsedEntries) {
          const block = extractFeatureFromTarballEntry(parsedEntry, entryName);
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

        const entryName = stripArchivePrefix(header.name);
        if (!(entryName.startsWith('codes/') && entryName.endsWith('.json') && header.type === 'file')) {
          await drainStream(stream);
          next();
          return;
        }

        const buffer = await streamToBuffer(stream);
        const parsed = JSON.parse(buffer.toString('utf-8')) as unknown;
        const codesets = extractCodesetsFromTarballEntry(parsed, entryName);

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
 * - Any error thrown by `ingestMediaFile` rejects the stream.
 *
 * @param {Readable} inputStream - Tar archive stream.
 * @param {ObjectStorageService} objectStorageService - Object storage client.
 * @param {string} s3KeyPrefix - Prefix prepended to uploaded media object keys.
 * @param {(uploadedFile: IUploadedMediaFile) => Promise<void>} [ingestMediaFile] - Optional callback after each upload.
 * @returns {Promise<{ uploadedCount: number }>} Count of uploaded media files.
 * @throws {Error} When stream processing, upload, or callback processing fails.
 */
export async function streamMedia(
  inputStream: Readable,
  objectStorageService: ObjectStorageService,
  s3KeyPrefix: string,
  ingestMediaFile?: (uploadedFile: IUploadedMediaFile) => Promise<void>
): Promise<{ uploadedCount: number }> {
  const extract = tar.extract();
  let uploadedCount = 0;

  let rejectEntryPromise: (err: unknown) => void;

  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', async (header, stream, next) => {
      try {
        const entryName = stripArchivePrefix(header.name);

        // Only process media files under files/
        if (entryName.startsWith('files/') && header.type === 'file') {
          const path = entryName.substring('files/'.length).replace(/^\/+/, '');
          const fileName = nodePath.basename(path);
          const s3Key = `${s3KeyPrefix}/${path}`;
          const mimetype = mime.getType(fileName) ?? 'application/octet-stream';
          const byteSize = header.size ?? 0;
          const checksum = createHash('sha256');

          // Create a PassThrough to pipe the tar entry to S3
          const passThrough = new PassThrough();
          const checksumStream = new Transform({
            transform(chunk, _encoding, callback) {
              checksum.update(chunk as Buffer);
              callback(null, chunk);
            }
          });
          const checksumReady = new Promise<string>((resolve, reject) => {
            checksumStream.on('finish', () => resolve(checksum.digest('hex')));
            checksumStream.on('error', reject);
          });

          // Start the upload (don't await — let data flow through the pipe)
          const uploadPromise = objectStorageService
            .uploadStream(BucketType.MAIN, passThrough, mimetype, s3Key)
            .then(async () => {
              const checksumSha256 = await checksumReady;
              const uploadedFile: IUploadedMediaFile = {
                fileName,
                s3Key,
                path,
                byteSize,
                checksumSha256
              };
              uploadedCount += 1;

              if (ingestMediaFile) {
                return ingestMediaFile(uploadedFile);
              }

              return Promise.resolve();
            });

          // Pipe the tar entry stream into the PassThrough
          stream.pipe(checksumStream).pipe(passThrough);

          // Wait for the S3 upload to finish before advancing to the next entry.
          // This serializes uploads so only one PassThrough buffer exists at a time.
          uploadPromise.then(() => next()).catch((err) => reject(err));
        } else {
          // Drain non-media entries
          await drainStream(stream);
          next();
        }
      } catch (err) {
        reject(err);
      }
    });

    extract.on('finish', resolve);
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
