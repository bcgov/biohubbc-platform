interface ICreateSubmissionMetadata {
  name: string;
  description: string;
  uid: string | null;
  comment: string; // comments from the submitter about the submission
}

export interface CompleteMultipartUploadParams {
  systemUserId: number;
  systemUserIdentifier: string;
  metadata: ICreateSubmissionMetadata;
  quarantineId: string;
  uploadId: string;
  key: string;
  parts: Array<{ partNumber: number; etag: string }>;
}

interface PresignedUrl {
  partNumber: number;
  url: string;
}

export interface PresignedUploadUrlResponse {
  quarantineId: string;
  uploadId: string;
  key: string;
  partSizeBytes: number;
  partCount: number;
  presignedUrls: PresignedUrl[];
}
