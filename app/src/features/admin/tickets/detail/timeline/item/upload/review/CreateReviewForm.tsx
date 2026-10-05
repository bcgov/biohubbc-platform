import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

/**
 * Form fields for a new submission upload review context.
 *
 * @returns {JSX.Element} Create review form fields.
 */
export const CreateReviewForm = () => {
  return (
    <Stack gap={2} sx={{ pt: 1, minWidth: { xs: 300, sm: 520 } }}>
      <CustomTextFieldFormik label="Name" name="name" required inputProps={{ maxLength: 100 }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={3}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </Stack>
  );
};
