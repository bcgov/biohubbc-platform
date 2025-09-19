interface CompleteMultipartUploadParams {
  uploadId: string;
  key: string;
  parts: Array<{ partNumber: number; etag: string }>;
}
