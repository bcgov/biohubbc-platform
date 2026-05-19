import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { ExpressionPredicateOperator } from 'interfaces/expression.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

/** Generic paginated result */
interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/** Request parameters for simple feature search */
export interface ISearchAllFilters {
  keyword: string;
  feature_type_name?: string;
}

/** Feature search result (for combined search) */
export interface SearchFeatureResult {
  submission_feature_id: number;
  feature_type_id: number;
  feature_type_name: string;
  label: string;
}

export interface SearchFeatureResponse {
  features: SearchFeatureResultWithRelevancy[];
  pagination: ApiPaginationResponseParams;
}

/** Search result representing a matched feature with relevancy */
export interface SearchFeatureResultWithRelevancy {
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
  create_date: string;
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

/** Combined search response */
export interface SearchResponse {
  features: PaginatedResult<SearchFeatureResult>;
  submissions: PaginatedResult<SearchSubmissionResult>;
  taxonomy: PaginatedResult<SearchTaxonResult>;
}

/** Base summary row type */
interface SearchSummaryTotal {
  total: number;
}

/** Summary row for a feature type */
export interface SearchSummaryFeature extends SearchSummaryTotal {
  feature_type_name: PRIORITY_FEATURE_TYPE;
}

/** Summary row for a submission */
export type SearchSummarySubmission = SearchSummaryTotal;

/** Summary row for a taxon */
export type SearchSummaryTaxon = SearchSummaryTotal;

/** Response from the search summary endpoint */
export interface SearchSummaryResponse {
  features: SearchSummaryFeature[];
  submissions: SearchSummarySubmission;
  taxonomy: SearchSummaryTaxon;
}

/** Request parameters for searching properties */
export interface ISearchPropertyFilters {
  /** Free-text search term for properties (e.g., 'weight') */
  keyword?: string;

  /** Optional feature types to narrow the property search (e.g., ['species_observation']) */
  feature_types?: string[];
}

/**
 * Individual property result containing details and values grouped by type
 */
export interface SearchPropertyResult {
  feature_property_id: number;
  property_name: string;
  property_display_name: string;
  feature_property_type: SearchPropertyType;
  operators: ExpressionPredicateOperator[];
  relevancy_score: number;
}

export type SearchPropertyType = 'string' | 'number' | 'boolean' | 'datetime' | 'taxon' | 'spatial' | 'code';

/**
 * Grouped property results organized by value type
 */
export interface GroupedPropertyResults {
  string: SearchPropertyResult[];
  number: SearchPropertyResult[];
  boolean: SearchPropertyResult[];
  datetime: SearchPropertyResult[];
  taxon: SearchPropertyResult[];
  spatial: SearchPropertyResult[];
  code: SearchPropertyResult[];
}

/**
 * Complete property search response with grouped results and pagination
 */
export interface SearchPropertyResponse {
  properties: GroupedPropertyResults;
  pagination: ApiPaginationResponseParams;
}
