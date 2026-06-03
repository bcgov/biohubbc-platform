import Stack from '@mui/material/Stack';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import yup from 'utils/YupSchema';

/**
 * Form values for creating or editing a security reason.
 */
export interface IAddReasonFormValues {
  /** Reason name */
  name: string;
  /** Reason description */
  description: string;
  /** Selected security category ID */
  security_category_id: number | undefined;
}

/**
 * Default initial values for a new security reason form.
 */
export const AddReasonFormInitialValues: IAddReasonFormValues = {
  name: '',
  description: '',
  security_category_id: undefined
};

/**
 * Yup validation schema for the security reason form.
 */
export const AddReasonFormYupSchema = yup.object().shape({
  name: yup.string().required('Name is required').max(100, 'Name must be 100 characters or less'),
  description: yup.string().required('Description is required').max(500, 'Description must be 500 characters or less'),
  security_category_id: yup.number().required('Category is required')
});

interface IAddReasonFormProps {
  /** Active security categories available for selection */
  categoryOptions: ICustomAutocompleteOption<number>[];
}

/**
 * Form component for creating or editing a security reason.
 *
 * Must be used within a Formik context (wrapped by EditDialog or similar).
 *
 * @param {IAddReasonFormProps} props
 * @returns {React.ReactElement}
 */
export const AddReasonForm = (props: IAddReasonFormProps) => {
  const { categoryOptions } = props;

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
      <CustomAutocompleteFormik
        id="security_category_id"
        name="security_category_id"
        label="Category"
        required
        options={categoryOptions}
      />
    </Stack>
  );
};
