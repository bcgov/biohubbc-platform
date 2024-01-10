export type FeatureTypeCode = {
  id: number;
  name: string;
};

export type FeatureTypeWithFeaturePropertiesCode = {
  feature_type: FeatureTypeCode;
  feature_type_properties: FeaturePropertyCode[];
};

export type FeaturePropertyCode = {
  id: number;
  name: string;
  display_name: string;
  type: string;
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
