import yup from 'utils/YupSchema';

export const typeAssignmentSchema = yup.object({
  featureTypes: yup
    .array()
    .of(yup.object({ featureTypeId: yup.number().positive().integer().required(), label: yup.string().required() }))
    .min(1, 'Select at least one feature type')
    .required()
});
export const propertyAssignmentSchema = yup.object({
  blueprintFeatureTypeId: yup.number().positive().integer().required('Select a feature type'),
  featurePropertyId: yup.number().positive().integer().required('Select a property'),
  requiredValue: yup.boolean().required(),
  allowMultiple: yup.boolean().required()
});

export const createPropertyAssignmentSchema = yup.object({
  properties: yup
    .array()
    .of(yup.object({ featurePropertyId: yup.number().positive().integer().required(), label: yup.string().required() }))
    .min(1, 'Select at least one property')
    .required()
});
