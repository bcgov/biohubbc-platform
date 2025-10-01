export interface CompleteMultipartUploadParams {
  uploadId: string;
  key: string;
  parts: Array<{ partNumber: number; etag: string }>;
}

interface PresignedUrl {
  partNumber: number;
  url: string;
}

export interface PresignedUploadUrlResponse {
  uploadId: string;
  key: string;
  partSizeBytes: number;
  partCount: number;
  presignedUrls: PresignedUrl[];
}
