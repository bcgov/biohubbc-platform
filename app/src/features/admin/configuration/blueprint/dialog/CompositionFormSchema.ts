import yup from 'utils/YupSchema';

export const typeAssignmentSchema = yup.object({
  featureTypes: yup
    .array()
    .of(yup.object({ featureTypeId: yup.number().positive().integer().required(), label: yup.string().required() }))
    .min(1, 'Select at least one feature type')
    .required()
});
