import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';

export interface SearchFeaturesParams {
  search?: string;
}

/** Feature search result */
export interface SearchFeatureResult {
  submission_feature_id: number;
  feature_type_id: number;
  label: string;
}

/** Submission search result */
export interface SearchSubmissionResult {
  submission_id: number;
  name: string;
  description?: string | null;
}

/** Taxon search result */
export interface SearchTaxonResult {
  taxon_id: number;
  itis_scientific_name: string;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/** Combined search response */
export interface SearchResponse {
  features: PaginatedResult<SearchFeatureResult>;
  submissions: PaginatedResult<SearchSubmissionResult>;
  taxonomy: PaginatedResult<SearchTaxonResult>;
}

/**
 * Request parameters for searching features.
 */
export interface ISearchFeaturesRequest {
  keywords?: string;
  propertyFilters?: IPropertyFilter[];
}

/**
 * A property filter for narrowing search results.
 */
export interface IPropertyFilter {
  featureTypeName: string;
  propertyName: string;
  propertyType: 'string' | 'number' | 'datetime';
  value: string;
}

/**
 * A search result representing a matched feature.
 */
export type SearchFeatureResultWithRelevance = {
  submission_feature_id: number;
  submission_id: number;
  uuid: string;
  feature_type_id: number;
  feature_type_name: string;
  feature_name: string | null;
  feature_description: string | null;
  submission_name: string;
  is_secured: boolean;
  relevancy_score: number;
};

interface SearchSummaryTotal {
  total: number;
}

/** Summary row for a feature */
export interface SearchSummaryFeature extends SearchSummaryTotal {
  feature_type_name: PRIORITY_FEATURE_TYPE;
}

/** Summary row for a submission */
export type SearchSummarySubmission = SearchSummaryTotal;

/** Summary row for a taxon */
export type SearchSummaryTaxon = SearchSummaryTotal;

/** Response from the search summary endpoint with type-specific rows as arrays */
export interface SearchSummaryResponse {
  features: SearchSummaryFeature[];
  submissions: SearchSummarySubmission;
  taxonomy: SearchSummaryTaxon;
}
