import { HEX_COLOR_PATTERN } from 'constants/tag';
import yup from 'utils/YupSchema';

export const SwimlaneYupSchema = yup.object().shape({
  name: yup.string().trim().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: yup.string().nullable().max(250, 'Description must be 250 characters or less'),
  color: yup.string().nullable().matches(HEX_COLOR_PATTERN, 'Color must be a hex color'),
  isVisible: yup.boolean().required(),
  tags: yup.array()
});
