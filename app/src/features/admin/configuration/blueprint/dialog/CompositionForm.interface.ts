export interface ITypeAssignmentForm {
  featureTypes: { featureTypeId: number; label: string }[];
}
export interface IPropertyAssignmentForm {
  properties: { featurePropertyId: number; label: string }[];
  blueprintFeatureTypeId: number | '';
  featurePropertyId: number | '';
  requiredValue: boolean;
  allowMultiple: boolean;
}
