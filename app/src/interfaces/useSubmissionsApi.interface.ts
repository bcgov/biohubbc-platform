import { ApiPaginationResponseParams } from 'types/pagination';
import { JsonValue } from 'types/json';
import { SECURITY_APPLIED_STATUS } from './useArtifactApi.interface';

export type SubmissionRecord = {
  submission_id: number;
  uuid: string;
  security_review_timestamp: string | null;
  publish_timestamp: string | null;
  submitted_timestamp: string;
  contributor_id: number;
  name: string;
  description: string;
  comment: string;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
};

export type SubmissionRecordWithSecurity = SubmissionRecord & {
  security: SECURITY_APPLIED_STATUS;
};

export type SubmissionRecordWithSecurityAndRootFeature = SubmissionRecord & {
  security: SECURITY_APPLIED_STATUS;
  root_feature_type_id: number;
  root_feature_type_name: string;
  regions: string[];
};

export type SubmissionSummary = Pick<
  SubmissionRecord,
  | 'submission_id'
  | 'uuid'
  | 'publish_timestamp'
  | 'submitted_timestamp'
  | 'contributor_id'
  | 'name'
  | 'description'
  | 'comment'
  | 'create_user'
  | 'update_user'
> & {
  system_user_id: number;
  security: SECURITY_APPLIED_STATUS;
  regions: string[];
};

export type SubmissionRecordPublishedForPublic = Omit<SubmissionRecord, 'comment'> & {
  security: SECURITY_APPLIED_STATUS;
  root_feature_type_id: number;
  root_feature_type_name: string;
  root_feature_type_display_name: string;
};

export interface ISubmissionFeature {
  submission_id: number;
  uuid: string;
  security_review_timestamp: string;
  create_date: string;
  create_user: string;
}

export interface IPostSubmissionFeature {
  feature_type: string;
  properties: Record<string, JsonValue>;
  children: IPostSubmissionFeature[];
}

export interface ISubmissionUploadPart {
  PartNumber: number;
  ETag: string;
}

export type SubmissionFeatureRecordWithTypeAndSecurity = {
  submission_feature_id: number;
  uuid: string;
  submission_id: number;
  feature_type_id: number;
  source_id: string;
  data: Record<string, any>;
  parent_submission_feature_id: number;
  record_effective_date: string;
  record_end_date: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
  feature_type_name: string;
  feature_type_display_name: string;
  submission_feature_security_ids: number[];
};

export interface IGetSubmissionGroupedFeatureResponse {
  feature_type_name: string;
  feature_type_display_name: string;
  features: SubmissionFeatureRecordWithTypeAndSecurity[];
}

export type ISubmissionFeatureForReview = {
  submission_feature_id: number;
  uuid: string;
  submission_id: number;
  feature_type_id: number;
  feature_type_name: string;
  secured: boolean;
  submission_feature_security_ids: number[];
};

export interface ISubmissionFeatureForReviewResponse {
  features: ISubmissionFeatureForReview[];
  pagination: ApiPaginationResponseParams;
}

export interface IGetSubmissionsForUserResponse {
  submissions: SubmissionSummary[];
  pagination: ApiPaginationResponseParams;
}

export interface SubmissionFilters {
  search?: string;
}

export interface PresignedUrl {
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

export interface ICreateSubmission {
  bytes: number;
  name: string;
  description: string;
  comment: string;
}
