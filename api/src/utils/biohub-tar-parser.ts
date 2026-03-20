import mime from 'mime';
import { createHash } from 'node:crypto';
import nodePath from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar-stream';
import { ZodError, z } from 'zod';
import { CreateSubmissionFeature, IFlattenedBlock } from '../models/submission-feature';
import {
  TarCodesets
} from '../services/ingestion/submission-ingestion-codes-service.interface';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { IUploadedMediaFile } from './biohub-tar-parser.interface';

/**
 * Strip the optional archive directory prefix added by SIMS.
 * Real SIMS archives wrap all entries under a UUID directory, e.g.:
 *   `6b916891-22d5-4c63-a972-33261b1f7c6b/.dataset-id`
 *   `6b916891-22d5-4c63-a972-33261b1f7c6b/dataset.json`
 *   `6b916891-22d5-4c63-a972-33261b1f7c6b/files/photo.jpg`
 *
 * This normalizes entry names so the parser works with both flat and prefixed archives.
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
 * Collect all data from a stream into a single Buffer.
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
 */
function drainStream(stream: Readable): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
    stream.resume();
  });
}

/**
 * Parse and shallow-validate one codeset JSON entry from the tarball.
 *
 * Supports both accepted payload shapes:
 * - Root object is the codesets map
 * - Root object contains a `categories` property with the codesets map
 *
 * Throws a generic shallow-validation error message for schema failures.
 */
function extractCodesetsFromTarballEntry(value: unknown): TarCodesets {
  const parsedRoot = z.record(z.string(), z.unknown()).parse(value);
  const codesetsValue = Object.prototype.hasOwnProperty.call(parsedRoot, 'categories')
    ? parsedRoot.categories
    : parsedRoot;

  try {
    return TarCodesets.parse(codesetsValue);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error('Codeset entry failed shallow validation');
    }

    throw error;
  }
}

/**
 * Parse a single unknown JSON value into a shallow-validated flattened feature block.
 */
function extractFeatureFromTarballEntry(value: unknown): IFlattenedBlock {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Feature entry must be an object');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim()) {
    throw new Error('Feature entry is missing required string field: id');
  }

  if (typeof record.type !== 'string' || !record.type.trim()) {
    throw new Error('Feature entry is missing required string field: type');
  }

  if (typeof record.properties !== 'object' || record.properties === null || Array.isArray(record.properties)) {
    throw new Error('Feature entry is missing required object field: properties');
  }

  const parent =
    record.parent === undefined || record.parent === null
      ? null
      : typeof record.parent === 'string'
      ? record.parent
      : (() => {
          throw new Error('Feature entry field parent must be a string when provided');
        })();

  const rawReferences = Array.isArray(record.references)
    ? record.references
    : Array.isArray(record.content)
    ? record.content
    : [];
  const content: string[] = [];
  for (const reference of rawReferences) {
    if (typeof reference !== 'string') {
      throw new Error('Feature entry references/content must contain only strings');
    }

    content.push(reference);
  }

  return {
    id: record.id.trim(),
    type: record.type.trim(),
    properties: record.properties as Record<string, unknown>,
    content,
    parent
  };
}

/**
 * Build the raw JSONB payload persisted in submission_feature.data.
 */
export function buildFeatureDataPayload(block: IFlattenedBlock): CreateSubmissionFeature {
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
        const isFeatureJson =
          (entryName.startsWith('features/') && entryName.endsWith('.json')) ||
          (entryName.endsWith('.json') && !entryName.includes('/') && entryName !== 'dataset.json');

        if (!isFeatureJson) {
          await drainStream(stream);
          next();
          return;
        }

        const buffer = await streamToBuffer(stream);
        const parsed = JSON.parse(buffer.toString('utf-8')) as unknown;
        const parsedEntries = Array.isArray(parsed) ? parsed : [parsed];

        for (const parsedEntry of parsedEntries) {
          const block = extractFeatureFromTarballEntry(parsedEntry);
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
        const codesets = extractCodesetsFromTarballEntry(parsed);

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
