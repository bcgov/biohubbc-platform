import { ApiPaginationResponseParams } from 'types/misc';

export interface ISubmissionFeatureResponse {
  features: ISubmissionFeature[];
  pagination: ApiPaginationResponseParams;
}

export interface ISubmissionFeature {
  submission_feature_id: number;
  uuid: string;
  submission_id: number;
  feature_type_id: number;
  feature_type_name: string;
  source_id: string;
  data: Record<string, any>;
  secured: boolean;
}
