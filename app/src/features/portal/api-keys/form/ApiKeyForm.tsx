import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

export interface IApiKeyFormValues {
  name: string;
}

export const ApiKeyForm = () => {
  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik label="Key name" name="name" required autoFocus inputProps={{ maxLength: 200 }} />
      <FormHelperText>
        Choose a descriptive name so you can identify this key later (e.g. &quot;Parquet download script&quot;).
      </FormHelperText>
    </Stack>
  );
};
