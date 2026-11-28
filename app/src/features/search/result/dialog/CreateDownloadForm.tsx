import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

/**
 * Form values collected by the Create Download dialog.
 */
export interface ICreateDownloadFormValues {
  name: string;
  description: string | null;
}

/**
 * Form body for creating a download. The download scope is derived from the
 * current applied search expression by the parent workflow, so the form only
 * collects user-facing metadata.
 *
 * @returns {JSX.Element} Create download form fields.
 */
export const CreateDownloadForm = () => {
  return (
    <Stack gap={2} sx={{ pt: 1, minWidth: { xs: 300, sm: 520 } }}>
      <CustomTextFieldFormik label="Name" name="name" required inputProps={{ maxLength: 100 }} />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={3}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
    </Stack>
  );
};
