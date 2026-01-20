export interface UploadPart {
  PartNumber: number;
  ETag: string;
}

interface PresignedUrl {
  partNumber: number;
  url: string;
}

export interface PresignedUploadUrlResponse {
  submissionId: number;
  uploadId: string;
  s3UploadId: string;
  uploadArchiveId: string;
  key: string;
  partSizeBytes: number;
  partCount: number;
  presignedUrls: PresignedUrl[];
}

export interface CompleteMultipartUploadParams {
  uploadId: string;
  s3UploadId: string;
  key: string;
  parts: UploadPart[];
}
