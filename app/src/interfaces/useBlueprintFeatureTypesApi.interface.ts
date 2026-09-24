import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface IBlueprintFeatureType {
  blueprint_feature_type_id: number;
  blueprint_id: number;
  feature_type_id: number;
  name: string;
  display_name: string;
  description: string | null;
  sort: number | null;
  record_end_date: string | null;
}

export interface IBlueprintFeatureTypesResponse {
  types: IBlueprintFeatureType[];
  pagination: ApiPaginationResponseParams;
}

export interface ICreateBlueprintFeatureType {
  featureTypeId: number;
}

/**
 * Query options for blueprint feature-type assignments, including active-only membership.
 */
export interface IGetBlueprintFeatureTypesParams extends ApiPaginationRequestOptions {
  keyword?: string;
  active?: boolean;
}
