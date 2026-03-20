import mime from 'mime';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar-stream';
import { IFlattenedBlock } from '../models/submission-feature';
import type { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';
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
 */
export async function streamFeaturesFromTarball(
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
export async function streamCodesetsFromTarball(
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
        const parsed = JSON.parse(buffer.toString('utf-8')) as Record<string, unknown>;
        const categories =
          typeof parsed.categories === 'object' && parsed.categories !== null
            ? (parsed.categories as Record<string, unknown>)
            : parsed;
        const codesets: TarCodesets = {};
        for (const [categoryKey, categoryValue] of Object.entries(categories)) {
          codesets[categoryKey] = categoryValue as TarCodesets[string];
        }

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
export async function streamMediaFromTarball(
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
          const fileName = path.basename(entryName);
          const s3Key = `${s3KeyPrefix}/${fileName}`;
          const mimetype = mime.getType(fileName) ?? 'application/octet-stream';
          const byteSize = header.size ?? 0;

          // Create a PassThrough to pipe the tar entry to S3
          const passThrough = new PassThrough();

          // Start the upload (don't await — let data flow through the pipe)
          const uploadPromise = objectStorageService
            .uploadStream(BucketType.MAIN, passThrough, mimetype, s3Key)
            .then(() => {
              const uploadedFile: IUploadedMediaFile = { fileName, s3Key, byteSize };
              uploadedCount += 1;

              if (ingestMediaFile) {
                return ingestMediaFile(uploadedFile);
              }

              return Promise.resolve();
            });

          // Pipe the tar entry stream into the PassThrough
          stream.pipe(passThrough);

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
