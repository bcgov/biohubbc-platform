import { ApiPaginationResponseParams } from 'types/pagination';

export interface IRelatedSubmissionFeature {
  submission_feature_id: number;
  feature_type_name: string;
  feature_type_display_name: string;
  data: Record<string, any>;
}

export interface ISubmissionFeature {
  submission_feature_id: number;
  uuid: string;
  urn: string;
  submission_id: number;
  feature_type_id: number;
  feature_type_name: string;
  feature_type_display_name: string;
  submission_name: string;
  source_id: string | null;
  data: Record<string, any>;
  secured: boolean;
}

export interface ISubmissionFeatureResponse {
  feature: ISubmissionFeature;
  relatedFeatures: IRelatedSubmissionFeature[];
}

export interface IFeaturePropertyRow {
  id: string;
  property: string;
  value: string;
}

export interface ISubmissionFeaturePropertiesResponse {
  properties: IFeaturePropertyRow[];
  pagination: ApiPaginationResponseParams;
}
