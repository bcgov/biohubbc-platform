import Box from '@mui/material/Box';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { useFormikContext } from 'formik';
import { ParentBlueprintAutocomplete } from './ParentBlueprintAutocomplete';
import { IParentBlueprintOptions } from './ParentBlueprintOptions.interface';
import { IBlueprintFormValues } from './ConfigurationForm.interface';

/**
 * Edit Blueprint metadata using the shared administrative dialog's Formik context.
 *
 * @param props Prepared parent choices for creation; omitted when editing metadata.
 * @returns Metadata form fields.
 */
export const BlueprintForm = ({ parentOptions }: { parentOptions?: IParentBlueprintOptions }) => {
  const { handleSubmit } = useFormikContext<IBlueprintFormValues>();
  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" gap={3} pt={1}>
        <CustomTextFieldFormik name="name" label="Name" type="text" fullWidth required />
        <CustomTextFieldFormik name="description" label="Description" type="text" fullWidth multiline rows={3} />
        {parentOptions && <ParentBlueprintAutocomplete parentOptions={parentOptions} />}
      </Box>
    </form>
  );
};
