import { Stack } from '@mui/material';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

/**
 * Editable contributor fields within an EditDialog Formik context.
 * @returns Client ID and description inputs.
 */
export const ContributorForm = () => {
  return (
    <Stack gap={2} sx={{ pt: 1, minWidth: 320 }}>
      <CustomTextFieldFormik name="clientId" label="Client ID" required slotProps={{ htmlInput: { maxLength: 100 } }} />
      <CustomTextFieldFormik
        name="description"
        label="Description"
        multiline
        minRows={3}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </Stack>
  );
};
