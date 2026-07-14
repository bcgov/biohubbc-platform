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
  security_reasons: string[];
}

export interface ISubmissionFeatureResponse {
  feature: ISubmissionFeature;
  relatedFeatures: IRelatedSubmissionFeature[];
}

/** A taxon reference value resolved from the indexed property tables. */
export interface TaxonPropertyValue {
  taxon_id: number;
  tsn: number | null;
  rank: string | null;
  label: string;
}

/** A code reference value resolved from the indexed property tables. */
export interface CodePropertyValue {
  codeset_key: string;
  codeset_label: string;
  code_key: string;
  code_label: string;
  label: string;
}

/** A feature reference value resolved from the indexed property tables. */
export interface FeaturePropertyValue {
  urn: string;
  label: string;
}

/**
 * Reference-typed submitted property values resolve to structured objects carrying a display
 * `label` plus stable identifiers, so the UI can render the label as a link/link-like element while
 * retaining the identifiers for routing, hover previews, and formatting.
 */
export type StructuredPropertyValue = TaxonPropertyValue | CodePropertyValue | FeaturePropertyValue;

export interface IFeaturePropertyRow {
  id: string;
  property: string;
  value: string | StructuredPropertyValue;
}

export interface SubmissionFeaturePropertyFilters {
  search?: string;
}

export interface ISubmissionFeaturePropertiesResponse {
  properties: IFeaturePropertyRow[];
  pagination: ApiPaginationResponseParams;
}
