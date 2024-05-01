import { SECURITY_APPLIED_STATUS } from './useDatasetApi.interface';

/** NET-NEW INTERFACES FOR UPDATED SCHEMA **/

export type SubmissionRecord = {
  submission_id: number;
  uuid: string;
  security_review_timestamp: string | null;
  publish_timestamp: string | null;
  submitted_timestamp: string;
  source_system: string;
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

export interface IGetDownloadSubmissionResponse {
  submission_feature_id: number;
  parent_submission_feature_id: number;
  feature_type_name: string;
  data: Record<string, any>;
  level: number;
}

export type SubmissionFeatureSignedUrlPayload = {
  submissionId: number;
  submissionFeatureId: number;
  submissionFeatureKey: string;
  submissionFeatureValue: string;
};
