import { SearchFeatureResult, SearchSubmissionResult, SearchTaxonResult } from '../models/search';

export interface SearchParams {
  search: string;
  feature_type_name?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface SearchResponseWithPagination {
  features: PaginatedResult<SearchFeatureResult>;
  submissions: PaginatedResult<SearchSubmissionResult>;
  taxonomy: PaginatedResult<SearchTaxonResult>;
}
