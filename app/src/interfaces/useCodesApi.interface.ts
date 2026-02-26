export type FeatureTypeCode = {
  feature_type_id: number;
  feature_type_name: string;
  feature_type_display_name: string;
};

export type FeatureTypeWithFeaturePropertiesCode = {
  feature_type: FeatureTypeCode;
  feature_type_properties: FeaturePropertyCode[];
};

export type FeaturePropertyCode = {
  feature_property_id: number;
  feature_property_name: string;
  feature_property_display_name: string;
  feature_property_type_id: number;
  feature_property_type_name: string;
};

/**
 * Get all codes response object.
 *
 * @export
 * @interface IGetAllCodeSetsResponse
 */
export interface IGetAllCodeSetsResponse {
  feature_type_with_properties: FeatureTypeWithFeaturePropertiesCode[];
}
