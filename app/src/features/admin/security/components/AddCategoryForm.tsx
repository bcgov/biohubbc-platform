import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import yup from 'utils/YupSchema';

/**
 * Form values for creating or editing a security category.
 */
export interface IAddCategoryFormValues {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
}

/**
 * Default initial values for a new security category form.
 */
export const AddCategoryFormInitialValues: IAddCategoryFormValues = {
  name: '',
  description: ''
};

/**
 * Yup validation schema for the security category form.
 */
export const AddCategoryFormYupSchema = yup.object().shape({
  name: yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: yup.string().required('Description is required').max(500, 'Description must be 500 characters or less')
});

/**
 * Form component for creating or editing a security category.
 *
 * Must be used within a Formik context (wrapped by EditDialog or similar).
 *
 * @returns {React.ReactElement}
 */
export const AddCategoryForm = () => {
  return (
    <Stack gap={2} sx={{ pt: 1, minWidth: { xs: 300, sm: 520 } }}>
      <CustomTextFieldFormik label="Name" name="name" required inputProps={{ maxLength: 100 }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        required
        multiline
        minRows={3}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </Stack>
  );
};
