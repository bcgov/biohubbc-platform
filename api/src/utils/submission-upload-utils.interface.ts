export interface MultipartUploadParams {
  key: string;
  contentType: string;
  bytes: number;
}

export interface MultipartUploadResult {
  uploadId: string;
  presignedUrls: Array<{ partNumber: number; url: string }>;
  partSizeBytes: number;
  partCount: number;
}
