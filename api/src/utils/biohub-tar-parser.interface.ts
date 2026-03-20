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
}
