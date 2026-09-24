import { ApiPaginationResponseParams } from 'types/pagination';

export interface IFeatureType {
  feature_type_id: number;
  name: string;
  display_name: string;
  description: string | null;
  record_effective_date?: string;
  record_end_date?: string | null;
}
export interface IFeatureTypesResponse {
  feature_types: IFeatureType[];
  pagination: ApiPaginationResponseParams;
}
export interface ICreateFeatureType {
  name: string;
  display_name: string;
  description: string | null;
}
export interface IUpdateFeatureType {
  display_name?: string;
  description?: string | null;
}
