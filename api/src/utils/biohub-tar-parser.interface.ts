import { ObjectStorageService } from '../services/object-storage/object-storage-service';

export interface IUploadedMediaFile {
  /** Original filename (e.g. "photo.jpg") */
  fileName: string;
  /** The S3 key the file was uploaded to */
  s3Key: string;
  /** Original file path relative to files/ in the tar archive */
  path: string;
  /** File size in bytes from TAR header */
  byteSize: number;
  /** SHA-256 checksum computed from streamed bytes */
  checksumSha256: string;
  /** MIME type derived from filename (e.g. "image/png", "application/octet-stream") */
  mimetype: string;
}

export type TarNext = () => void;

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

export interface ProcessMediaEntryOptions {
  objectStorageService: ObjectStorageService;
  s3KeyPrefix: string;
  ingestMediaFile: (uploadedFile: IUploadedMediaFile) => Promise<void>;
  onUploaded: () => void;
}

export interface StreamMediaOptions {
  objectStorageService: ObjectStorageService;
  s3KeyPrefix: string;
  batchSize: number;
  maxBatchBytes: number;
  ingestMediaBatch: (uploadedFiles: IUploadedMediaFile[]) => Promise<void>;
}
