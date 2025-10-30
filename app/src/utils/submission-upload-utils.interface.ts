import { AxiosResponse } from 'axios';

/**
 * Represents a single file to include in a PAX (or TAR) archive.
 */
export interface TarFileData {
  /** The name of the file in the archive */
  name: string;
  /** The binary content of the file */
  content: Uint8Array;
  /** Optional PAX headers for extended metadata (e.g., long filenames, custom fields) */
  pax?: Record<string, string>;
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
  /** Callback called after each part or batch upload to track progress */
  onProgress?: (completedParts: number, totalParts: number) => void;
}

/**
 * Options for streaming archive upload operations.
 */
export interface StreamUploadOptions extends UploadOptions {
  /** Chunk size when streaming files (default: 10 MB) */
  chunkSize: number;
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
