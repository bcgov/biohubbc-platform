import yup from 'utils/YupSchema';

export const BoardYupSchema = yup.object().shape({
  name: yup.string().trim().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: yup.string().nullable().max(500, 'Description must be 500 characters or less')
});
