import mime from 'mime';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar-stream';
import { IFlattenedBlock } from '../models/submission-feature';
import { BucketType, ObjectStorageService } from '../services/object-storage/object-storage-service';
import { IExtractedBlocks, IUploadedCodesetFile, IUploadedMediaFile } from './biohub-tar-parser.interface';

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
 * Pass 1: Extract JSON blocks and media filenames from a TAR archive stream.
 * Media content is drained (not buffered or uploaded).
 */
export async function extractBlocksFromArchive(inputStream: Readable): Promise<IExtractedBlocks> {
  const extract = tar.extract();

  let datasetId: string | undefined;
  const blocksByType = new Map<string, IFlattenedBlock[]>();
  const mediaFileNames = new Set<string>();
  const codesets: Record<string, unknown> = {};

  let rejectEntryPromise: (err: unknown) => void;

  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', async (header, stream, next) => {
      try {
        // Skip directory entries
        if (header.type === 'directory') {
          await drainStream(stream);
          next();
          return;
        }

        const entryName = stripArchivePrefix(header.name);

        if (entryName === '.dataset-id') {
          const buf = await streamToBuffer(stream);
          datasetId = buf.toString('utf-8').trim();
        } else if (entryName.startsWith('codes/') && header.type === 'file') {
          // codes/<file> entries define codesets used by code-slug validation.
          const buf = await streamToBuffer(stream);
          const parsed = JSON.parse(buf.toString('utf-8')) as Record<string, unknown>;
          const categories =
            typeof parsed['categories'] === 'object' && parsed['categories'] !== null
              ? (parsed['categories'] as Record<string, unknown>)
              : parsed;

          for (const [categoryKey, categoryValue] of Object.entries(categories)) {
            codesets[categoryKey] = categoryValue;
          }
        } else if (entryName.endsWith('.json') && !entryName.includes('/')) {
          // Root-level JSON file → parse as blocks
          const buf = await streamToBuffer(stream);
          const typeName = path.basename(entryName, '.json');
          const blocks: IFlattenedBlock[] = JSON.parse(buf.toString('utf-8'));
          blocksByType.set(typeName, blocks);
        } else if (entryName.startsWith('files/') && header.type === 'file') {
          // Media file → record filename, drain content
          const fileName = path.basename(entryName);
          mediaFileNames.add(fileName);
          await drainStream(stream);
        } else {
          await drainStream(stream);
        }

        next();
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

  if (datasetId === undefined) {
    throw new Error('Archive is missing required .dataset-id file');
  }

  // Build allBlocks from all type arrays
  const allBlocks: IFlattenedBlock[] = [];
  for (const blocks of blocksByType.values()) {
    allBlocks.push(...blocks);
  }

  return { datasetId, blocksByType, allBlocks, mediaFileNames, codesets };
}

/**
 * Pass 2: Stream media files from a TAR archive to S3.
 * JSON and metadata entries are skipped (already parsed in pass 1).
 */
export async function extractAndUploadMedia(
  inputStream: Readable,
  objectStorageService: ObjectStorageService,
  s3KeyPrefix: string
): Promise<Map<string, IUploadedMediaFile>> {
  const extract = tar.extract();
  const uploadedFiles = new Map<string, IUploadedMediaFile>();

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
              uploadedFiles.set(fileName, { fileName, s3Key, byteSize });
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

  return uploadedFiles;
}

/**
 * Pass 2b: Stream codeset files from a TAR archive to S3.
 * Only files under `codes/` are uploaded.
 */
export async function extractAndUploadCodesets(
  inputStream: Readable,
  objectStorageService: ObjectStorageService,
  s3KeyPrefix: string
): Promise<Map<string, IUploadedCodesetFile>> {
  const extract = tar.extract();
  const uploadedFiles = new Map<string, IUploadedCodesetFile>();

  let rejectEntryPromise: (err: unknown) => void;

  const entryPromise = new Promise<void>((resolve, reject) => {
    rejectEntryPromise = reject;

    extract.on('entry', async (header, stream, next) => {
      try {
        const entryName = stripArchivePrefix(header.name);

        if (entryName.startsWith('codes/') && header.type === 'file') {
          const fileName = path.basename(entryName);
          const s3Key = `${s3KeyPrefix}/${fileName}`;
          const mimetype = mime.getType(fileName) ?? 'application/json';
          const byteSize = header.size ?? 0;

          const passThrough = new PassThrough();

          const uploadPromise = objectStorageService
            .uploadStream(BucketType.MAIN, passThrough, mimetype, s3Key)
            .then(() => {
              uploadedFiles.set(fileName, { fileName, s3Key, byteSize });
            });

          stream.pipe(passThrough);
          uploadPromise.then(() => next()).catch((err) => reject(err));
        } else {
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

  pipeline(inputStream, extract).catch((err) => {
    rejectEntryPromise(err);
  });

  await entryPromise;

  return uploadedFiles;
}
