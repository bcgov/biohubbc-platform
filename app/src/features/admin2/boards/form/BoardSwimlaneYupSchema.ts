import { HEX_COLOR_DIGITS_PATTERN } from 'constants/tag';
import yup from 'utils/YupSchema';

export const BoardSwimlaneYupSchema = yup.object().shape({
  name: yup.string().trim().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: yup.string().nullable().max(250, 'Description must be 250 characters or less'),
  color: yup.string().matches(HEX_COLOR_DIGITS_PATTERN, {
    message: 'Color must be a 6-digit hex code, such as 1A5A96',
    excludeEmptyString: true
  }),
  sortOrder: yup.string().matches(/^\d*$/, 'Sort order must be a whole number, such as 0 or 3')
});
