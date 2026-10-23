import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

export interface IBoardFormValues {
  name: string;
  description: string | null;
}

/**
 * Board fields: name and description. Rendered inside an `EditDialog`, which owns the Formik state.
 *
 * @returns {JSX.Element} The board form fields.
 */
export const BoardForm = () => {
  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Name" name="name" required slotProps={{ htmlInput: { maxLength: 100 } }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </Stack>
  );
};
