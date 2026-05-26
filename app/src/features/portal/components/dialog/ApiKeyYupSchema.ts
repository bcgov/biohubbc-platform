import yup from 'utils/YupSchema';

export const ApiKeyYupSchema = yup.object().shape({
  name: yup.string().trim().required('Key name is required').max(200, 'Key name must be 200 characters or less')
});
