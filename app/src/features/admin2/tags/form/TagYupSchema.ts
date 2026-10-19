import { HEX_COLOR_PATTERN } from 'constants/tag';
import yup from 'utils/YupSchema';

export const TagYupSchema = yup.object().shape({
  name: yup.string().trim().required('Name is required').max(50, 'Name must be 50 characters or less'),
  description: yup.string().nullable().max(250, 'Description must be 250 characters or less'),
  color: yup.string().required('Color is required').matches(HEX_COLOR_PATTERN, 'Color must be a hex color')
});
