import Stack from '@mui/material/Stack';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';

export interface IBlueprintMetadataFormValues {
  name: string;
  description: string;
}

/**
 * Edit the blueprint's name and description in the shared dialog.
 *
 * @returns Formik metadata fields.
 */
export const BlueprintMetadataForm = () => {
  const { handleSubmit } = useFormikContext<IBlueprintMetadataFormValues>();
  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3} pt={1}>
        <CustomTextFieldFormik name="name" label="Name" fullWidth required />
        <CustomTextFieldFormik name="description" label="Description" fullWidth multiline rows={3} />
      </Stack>
    </form>
  );
};
