import { SubmissionPropertyValue } from 'interfaces/property-value.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

export interface ISubmissionFeature {
  submission_feature_id: number;
  uuid: string;
  urn: string;
  create_date: string;
  submission_id: number;
  feature_type_id: number;
  feature_type_name: string;
  feature_type_display_name: string;
  submission_name: string;
  contributor_name: string;
  source_id: string | null;
  successor_submission_feature_id: number | null;
  data?: Record<string, any>;
  secured: boolean;
  security_reasons: string[];
}

export interface ISubmissionFeatureResponse {
  feature: ISubmissionFeature;
}

export interface IFeaturePropertyRow {
  id: string;
  property: string;
  value: SubmissionPropertyValue;
}

export interface SubmissionFeaturePropertyFilters {
  search?: string;
}

export interface ISubmissionFeaturePropertiesResponse {
  properties: IFeaturePropertyRow[];
  pagination: ApiPaginationResponseParams;
}
