import yup from 'utils/YupSchema';

/**
 * Validation schema for the Create Download form. Mirrors the backend `.strict()` Zod schema
 * for `POST /api/download` so the client and server reject the same shapes.
 */
export const CreateDownloadFormYup = yup.object().shape({
  name: yup.string().trim().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: yup.string().nullable().max(1000, 'Description must be 1000 characters or less'),
  featureTypes: yup.array().of(yup.string().required()).min(1, 'Select at least one feature type').required()
});
