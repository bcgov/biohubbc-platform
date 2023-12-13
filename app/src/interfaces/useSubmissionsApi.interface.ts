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

export interface ISubmission {
  submission_id: number;
  submission_feature_id: number;
  name: string;
  description: string;
  submission_date: Date;
  security: SECURITY_APPLIED_STATUS;
}

export interface ISubmissionFeature {
  submission_id: number;
  uuid: string;
  security_review_timestamp: string;
  create_date: string;
  create_user: string;
}
export interface IFeature {
  submission_feature_id: number;
  submission_id: number;
  feature_type: string;
  data: any;
  submission_feature_security_ids: number[];
  parent_submission_feature_id: number | null;
}
export interface IGetSubmissionResponse {
  submission: ISubmissionFeature;
  features: {
    dataset: IFeature[];
    sampleSites: IFeature[];
    animals: IFeature[];
    observations: IFeature[];
  };
}
