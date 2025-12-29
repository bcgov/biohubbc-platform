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
export type SearchFeatureResult = {
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
