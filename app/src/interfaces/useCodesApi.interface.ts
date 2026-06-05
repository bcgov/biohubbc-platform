export type FeatureType = {
  feature_type_id: number;
  name: string;
  display_name: string;
  description: string | null;
};

export type FeatureTypeWithProperties = {
  feature_type: FeatureType;
  properties: FeatureTypeProperty[];
};

export type FeatureTypeProperty = {
  feature_type_property_id: number;
  name: string;
  display_name: string;
  description: string | null;
  type_name: string;
  required_value: boolean;
  calculated_value: boolean;
};

/**
 * Get all codes response object.
 *
 * @export
 * @interface IGetAllCodeSetsResponse
 */
export interface IGetAllCodeSetsResponse {
  feature_type_with_properties: FeatureTypeWithProperties[];
}
