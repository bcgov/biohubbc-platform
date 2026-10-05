export interface IFeatureTypeFormValues {
  name: string;
  display_name: string;
  description: string;
}
export interface IFeaturePropertyFormValues {
  name: string;
  display_name: string;
  description: string;
  feature_property_type_id: number | '';
  calculated_value: boolean;
}
export interface IBlueprintFormValues {
  name: string;
  description: string;
  parentBlueprintId: number | '';
}
