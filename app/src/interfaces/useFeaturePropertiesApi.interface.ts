import { ApiPaginationRequestOptions, ApiPaginationResponseParams } from 'types/pagination';

export interface IFeatureProperty {
  feature_property_id: number;
  feature_property_type_id: number;
  name: string;
  display_name: string;
  description: string | null;
  type_name: string;
  calculated_value: boolean;
  record_effective_date?: string;
  record_end_date?: string | null;
}
export interface IFeaturePropertiesResponse {
  feature_properties: IFeatureProperty[];
  pagination: ApiPaginationResponseParams;
}
export interface IFeaturePropertyType {
  feature_property_type_id: number;
  name: string;
}
export interface ICreateFeatureProperty {
  feature_property_type_id: number;
  name: string;
  display_name: string;
  description: string | null;
  calculated_value: boolean;
}
export interface IUpdateFeatureProperty {
  display_name?: string;
  description?: string | null;
}

export interface IAvailableFeaturePropertiesResponse {
  options: { id: number; name: string; display_name: string }[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Query options for global properties eligible for a blueprint feature-type assignment.
 */
export interface IGetAvailableFeaturePropertiesForBlueprintFeatureTypeParams extends ApiPaginationRequestOptions {
  keyword?: string;
}
