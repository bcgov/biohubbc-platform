export interface ISubmissionFeatureResponse {
  feature: ISubmissionFeature;
}

interface ISubmissionFeature {
  submission_feature_id: number;
  uuid: string;
  submission_id: number;
  feature_type_id: number;
  source_id: string;
  data: ISubmissionFeature;
  feature_type_name: string;
  secured: boolean;
}
