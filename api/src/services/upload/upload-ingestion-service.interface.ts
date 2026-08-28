export interface UploadPart {
  PartNumber: number;
  ETag: string;
}

interface PresignedUrl {
  partNumber: number;
  url: string;
  partSizeBytes: number;
}

export interface PresignedUploadUrlResponse {
  submissionUuid: string;
  submissionUploadId: string;
  uploadId: string;
  s3UploadId: string;
  uploadArchiveId: string;
  key: string;
  partCount: number;
  presignedUrls: PresignedUrl[];
}

export interface CompleteMultipartUploadParams {
  uploadId: string;
  s3UploadId: string;
  key: string;
  parts: UploadPart[];
}
