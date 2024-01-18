import { SECURITY_APPLIED_STATUS } from './useDatasetApi.interface';

export type IListSubmissionsResponse = Array<{
  submission_id: number;
  submission_status: string;
  source_transform_id: string;
  uuid: string;
  event_timestamp: string;
  delete_timestamp: string | null;
  input_key: string | null;
  input_file_name: string | null;
  eml_source: string | null;
  darwin_core_source: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}>;

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

export type SubmissionRecordPublished = SubmissionRecord & {
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
