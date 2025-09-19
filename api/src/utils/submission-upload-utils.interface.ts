interface MultipartUploadParams {
  key: string;
  contentType: string;
  expectedSizeBytes: number;
}

interface MultipartUploadResult {
  uploadId: string;
  presignedUrls: Array<{ partNumber: number; url: string }>;
  partSizeBytes: number;
  partCount: number;
}
