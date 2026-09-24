import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface IBlueprintFeatureTypeProperty {
  blueprint_feature_type_property_id: number;
  blueprint_feature_type_id: number;
  feature_property_id: number;
  feature_type_name: string;
  name: string;
  display_name: string;
  description: string | null;
  type_name: string;
  required_value: boolean;
  allow_multiple: boolean;
  sort: number | null;
  record_end_date: string | null;
}

export interface IBlueprintFeatureTypePropertiesResponse {
  properties: IBlueprintFeatureTypeProperty[];
  pagination: ApiPaginationResponseParams;
}

export interface ICreateBlueprintFeatureTypeProperty {
  blueprintFeatureTypeId: number;
  featurePropertyId: number;
  requiredValue?: boolean;
  allowMultiple?: boolean;
}

export interface IUpdateBlueprintFeatureTypeProperty {
  requiredValue?: boolean;
  allowMultiple?: boolean;
}

/**
 * Query options for property assignments across a blueprint.
 */
export interface IGetBlueprintFeatureTypePropertiesParams extends ApiPaginationRequestOptions {
  keyword?: string;
  blueprintFeatureTypeId?: number;
}
