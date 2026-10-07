import yup from 'utils/YupSchema';

export const featureTypeFormSchema = yup.object({
  name: yup.string().trim().required('Name is required').max(100),
  display_name: yup.string().trim().required('Display name is required').max(100),
  description: yup.string().max(500)
});
export const featurePropertyFormSchema = featureTypeFormSchema.shape({
  feature_property_type_id: yup.number().typeError('Select a property type').integer().positive().required(),
  calculated_value: yup.boolean().required()
});
export const blueprintFormSchema = yup.object({
  name: yup.string().trim().required('Name is required'),
  description: yup.string(),
  parentBlueprintId: yup
    .number()
    .transform((value, original) => (original === '' ? null : value))
    .nullable()
    .integer()
    .positive()
});
