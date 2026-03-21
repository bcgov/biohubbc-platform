import mime from 'mime';
import { createHash } from 'node:crypto';
import nodePath from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar-stream';
import { z, ZodError } from 'zod';
import { IFlattenedBlock } from '../models/submission-feature';
import { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { IUploadedMediaFile } from './biohub-tar-parser.interface';

const FlattenedFeatureEntrySchema = z
  .object({
    id: z.string(),
    type: z.string(),
    properties: z.record(z.unknown()),
    parent: z.string().nullable().optional(),
    references: z.array(z.string()).optional(),
    content: z.array(z.string()).optional()
  })
  .superRefine((value, ctx) => {
    if (!value.id.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Feature entry is missing required string field: id'
      });
    }

    if (!value.type.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Feature entry is missing required string field: type'
      });
    }
  });

const FlattenedFeatureSchema = FlattenedFeatureEntrySchema.transform((record) => {
  const normalizedReferences = record.references ?? record.content ?? [];

  return {
    id: record.id.trim(),
    type: record.type.trim(),
    properties: record.properties as Record<string, unknown>,
    content: normalizedReferences,
    parent: record.parent ?? null
  } as IFlattenedBlock;
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
 * @throws {Error} When payload shape does not satisfy `TarCodesets`.
 */
function extractCodesetsFromTarballEntry(value: unknown, entryName: string): TarCodesets {
  try {
    return TarCodesets.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Codeset entry failed shallow validation: entry=${entryName}; issues=${formatZodIssues(error)}`
      );
    }

    throw error;
  }
}

/**
 * Parse and shallow-validate one feature JSON object.
 *
 * Normalization behavior:
 * - trims `id` and `type`
 * - accepts references from `references` or legacy `content`
 * - coerces missing parent to `null`
 *
 * @param {unknown} value - Parsed JSON object for a single feature.
 * @param {string} entryName - Tar entry path for context.
 * @returns {IFlattenedBlock}
 * @throws {Error} When required fields are missing or incorrectly typed.
 */
function extractFeatureFromTarballEntry(value: unknown, entryName: string): IFlattenedBlock {
  try {
    return FlattenedFeatureSchema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Feature entry failed shallow validation: entry=${entryName}; issues=${formatZodIssues(error)}`
      );
    }

    throw error;
  }
}

/**
 * Convert a flattened feature block into the persisted raw feature payload.
 *
 * This keeps DB payload naming consistent (`references`) even though the
 * in-memory flattened block uses `content`.
 *
 * @param {IFlattenedBlock} block
 * @returns {Record<string, unknown>}
 */
export function buildFeatureDataPayload(block: IFlattenedBlock): Record<string, unknown> {
  return {
    id: block.id,
    type: block.type,
    properties: block.properties,
    references: block.content,
    parent: block.parent
  };
}

/**
 * Stream features from a TAR archive and emit fixed-size flattened batches.
 *
 * This is shallow validation only: shape checks needed to persist raw rows safely.
 * Only entries under `features/*.json` are parsed.
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
 * Only `codes/*.json` file entries are parsed.
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
 * Only `files/*` file entries are uploaded. Uploads are processed serially.
 * For each uploaded file, checksum and metadata are produced and optionally
 * passed to `ingestMediaFile`.
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
