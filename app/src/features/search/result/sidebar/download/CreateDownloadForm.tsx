import Stack from '@mui/material/Stack';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { CustomMultiAutocompleteFormik } from 'components/fields/CustomMultiAutocompleteFormik';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';

export interface ICreateDownloadFormValues {
  name: string;
  description: string | null;
  featureTypes: string[];
}

interface ICreateDownloadFormProps {
  featureTypeOptions: ICustomMultiAutocompleteOption[];
}

export const CreateDownloadForm = (props: ICreateDownloadFormProps) => {
  const { featureTypeOptions } = props;

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
      <CustomMultiAutocompleteFormik
        id="featureTypes"
        name="featureTypes"
        label="Feature Types"
        required
        chipVisible
        options={featureTypeOptions}
      />
    </Stack>
  );
};
