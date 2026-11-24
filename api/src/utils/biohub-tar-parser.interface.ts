import type { ExtractEvents } from 'tar-stream';
import { IFlattenedBlock } from '../models/submission-feature';
import { SubmissionArchiveFormat } from '../models/submission-upload';
import { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';
import { ObjectStorageService } from '../services/object-storage/object-storage-service';

export interface IUploadedMediaFile {
  /** Original filename (e.g. "photo.jpg") */
  fileName: string;
  /** The S3 key the file was uploaded to */
  s3Key: string;
  /** Original tarball-relative file path (for example, "files/images/photo.jpg") */
  path: string;
  /** File size in bytes from TAR header */
  byteSize: number;
  /** SHA-256 checksum computed from streamed bytes */
  checksumSha256: string;
  /** MIME type derived from filename (e.g. "image/png", "application/octet-stream") */
  mimetype: string;
}

export type TarNext = () => void;

/**
 * The data stream of one tar entry, as tar-stream hands it to an `entry` listener. It is a streamx `Readable`, which
 * tar-stream does not export by name, and its chunks are typed `unknown`.
 */
export type TarEntryStream = ExtractEvents['entry'][1];

export type TarEntryHeader = {
  name?: string | null;
  type?: string | null;
  size?: number;
  /** PAX extended header records, carried as the archive wrote them. */
  pax?: unknown;
};

export interface MediaUploadContext {
  path: string;
  fileName: string;
  s3Key: string;
  mimetype: string;
  byteSize: number;
}

export interface UploadMediaEntryOptions {
  objectStorageService: ObjectStorageService;
  ingestMediaFile: (uploadedFile: IUploadedMediaFile) => Promise<void>;
  onUploaded: () => void;
}

export interface StreamSubmissionArchiveOptions {
  /** Archive encoding; existing callers default to uncompressed TAR. */
  archiveFormat?: SubmissionArchiveFormat;
  objectStorageService: ObjectStorageService;
  s3KeyPrefix: string;
  featureBatchSize: number;
  featureMaxBatchBytes: number;
  mediaBatchSize: number;
  mediaMaxBatchBytes: number;
  mediaConcurrency: number;
  ingestFeatureBatch: (blocks: IFlattenedBlock[]) => Promise<void>;
  ingestCodesets: (codesets: TarCodesets) => Promise<void>;
  ingestMediaBatch: (uploadedFiles: IUploadedMediaFile[]) => Promise<void>;
}
