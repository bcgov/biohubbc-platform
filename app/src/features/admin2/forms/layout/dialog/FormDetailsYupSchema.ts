import yup from 'utils/YupSchema';

/**
 * Validation of a form's details. The slug is kebab-case, matching the API.
 */
export const formDetailsSchema = yup.object({
  slug: yup
    .string()
    .trim()
    .required('Slug is required')
    .max(100)
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens'),
  contributorId: yup.number().nullable().required('Contributor is required'),
  name: yup.string().trim().required('Name is required').max(100),
  description: yup.string().max(500),
  isPublic: yup.boolean().required()
});
