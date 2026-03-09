import { PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
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

/** Supported comparison operators for property filters */
export type SearchComparisonOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'exists';

/** Allowed property value types */
export type SearchPropertyValue = string | number | boolean | Array<string | number>;

/** A single property condition in a filter group */
export interface ISearchFeaturePropertyCondition {
  /** Property name (e.g., body_weight, sex, species) */
  name: string;

  /** Comparison operator */
  operator: SearchComparisonOperator;

  /** Value(s) to compare against */
  value?: SearchPropertyValue;
}

/** A group of property conditions combined by a logical operand */
export interface ISearchFeaturePropertyGroup {
  /** Logical operand: 'and' or 'or' */
  operand: 'and' | 'or';

  /** Conditions in this group */
  conditions: ISearchFeaturePropertyCondition[];
}

/**
 * Response from POST /api/download — a download created directly from search filters.
 * Bypasses the shopping cart; the download UUID is the access credential for anonymous users.
 */
export interface CreateDownloadResponse {
  download_id: string;
}

/** Request parameters for advanced feature search */
export interface ISearchFeaturesFilters {
  /** Free-text keyword search across all searchable properties */
  keyword?: string;

  /** Filter results by one or more feature types (e.g., species_observation) */
  feature_types?: string[];

  /** Filter results by one or more species */
  species?: number[];

  /** Structured property filters grouped by logical operand */
  properties?: ISearchFeaturePropertyGroup[];
}

/** Feature search result (for combined search) */
export interface SearchFeatureResult {
  submission_feature_id: number;
  feature_type_id: number;
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
  relevancy_score: number;
}

/**
 * Grouped property results organized by value type
 */
export interface GroupedPropertyResults {
  string: SearchPropertyResult[];
  number: SearchPropertyResult[];
  datetime: SearchPropertyResult[];
  spatial: SearchPropertyResult[];
}

/**
 * Complete property search response with grouped results and pagination
 */
export interface SearchPropertyResponse {
  properties: GroupedPropertyResults;
  pagination: ApiPaginationResponseParams;
}

/**
 * Filter criteria for property search
 */
export interface ISearchPropertyFilters {
  /** Free-text search term for properties (e.g., 'weight') */
  keyword?: string;
  /** Optional feature types to narrow the property search (e.g., ['species_observation']) */
  feature_types?: string[];
}
