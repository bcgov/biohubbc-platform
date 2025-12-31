import { SearchFeatureResult, SearchSubmissionResult, SearchTaxonResult } from '../models/search';

export interface SearchParams {
  keyword: string;
  feature_type_name?: string;
}

export interface WithCount<T> {
  data: T[];
  total: number;
}

export interface SearchResponseWithCounts {
  features: WithCount<SearchFeatureResult>;
  submissions: WithCount<SearchSubmissionResult>;
  taxonomy: WithCount<SearchTaxonResult>;
}
