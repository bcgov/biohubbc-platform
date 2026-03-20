export interface IUploadedMediaFile {
  /** Original filename (e.g. "photo.jpg") */
  fileName: string;
  /** The S3 key the file was uploaded to */
  s3Key: string;
  /** File size in bytes from TAR header */
  byteSize: number;
}
