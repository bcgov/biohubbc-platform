import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

export interface ITagFormValues {
  name: string;
  description: string | null;
  /** Hex color, `#RRGGBB`. */
  color: string;
}

/**
 * Tag fields: name, description and color. Rendered inside an `EditDialog`, which owns the Formik state.
 *
 * @returns {JSX.Element} The tag form fields.
 */
export const TagForm = () => {
  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Name" name="name" required slotProps={{ htmlInput: { maxLength: 50 } }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 250 } }}
      />
      <CustomTextFieldFormik label="Color" name="color" type="color" required sx={{ width: 120 }} />
    </Stack>
  );
};
