import { AxiosResponse } from 'axios';

/**
 * Represents a single file to include in a TAR archive.
 */
export interface TarFileData {
  /** The name of the file in the TAR archive */
  name: string;
  /** The binary content of the file */
  content: Uint8Array;
}

/**
 * Represents the result of uploading a single part in a multipart upload.
 */
export interface UploadResult {
  /** The part number in the multipart upload sequence */
  partNumber: number;
  /** The ETag returned by the server for this part */
  etag: string;
  /** The full HTTP response from the upload request */
  response: AxiosResponse;
}

/**
 * Options for multipart upload operations.
 */
export interface UploadOptions {
  /** Maximum number of simultaneous uploads (default: 4) */
  concurrencyLimit?: number;
  /** Callback called after each part or batch upload to track progress */
  onProgress?: (completedParts: number, totalParts: number) => void;
}

/**
 * Options for streaming TAR upload operations.
 */
export interface StreamUploadOptions extends UploadOptions {
  /** Optional chunk size when streaming files (default: 1 MB) */
  chunkSize?: number;
}

/**
 * Metadata used to create a submission.
 */
export interface SubmissionMetadata {
  /** The name of the submission */
  name: string;
  /** Optional description */
  description?: string;
  /** Any other metadata fields for the submission */
  [key: string]: any;
}

/**
 * Represents a TAR chunk generator function.
 */
export type TarChunkGenerator = AsyncGenerator<Uint8Array, void, unknown>;
