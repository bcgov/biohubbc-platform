import Box from '@mui/material/Box';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';
import { IFeatureTypeFormValues } from './ConfigurationForm.interface';

/**
 * Edit FeatureType metadata using the shared administrative dialog's Formik context.
 *
 * @param props Whether an existing feature type is being edited.
 * @returns Metadata form fields.
 */
export const FeatureTypeForm = ({ editing }: { editing: boolean }) => {
  const { handleSubmit } = useFormikContext<IFeatureTypeFormValues>();
  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" gap={3} pt={1}>
        {!editing && <CustomTextFieldFormik name="name" label="Name" type="text" fullWidth required />}
        <CustomTextFieldFormik name="display_name" label="Display name" type="text" fullWidth required />
        <CustomTextFieldFormik name="description" label="Description" type="text" fullWidth multiline rows={3} />
      </Box>
    </form>
  );
};
