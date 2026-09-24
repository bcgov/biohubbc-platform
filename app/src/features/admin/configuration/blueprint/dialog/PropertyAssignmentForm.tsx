import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useFormikContext } from 'formik';
import { IPropertyAssignmentForm } from './CompositionForm.interface';

/**
 * Edit the settings of an existing property assignment.
 *
 * @returns Formik assignment settings.
 */
export const PropertyAssignmentForm = () => {
  const { values, handleChange, handleSubmit } = useFormikContext<IPropertyAssignmentForm>();

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3} pt={1}>
        <FormControlLabel
          label="Required value"
          control={<Checkbox name="requiredValue" checked={values.requiredValue} onChange={handleChange} />}
        />
        <FormControlLabel
          label="Allow multiple"
          control={<Checkbox name="allowMultiple" checked={values.allowMultiple} onChange={handleChange} />}
        />
      </Stack>
    </form>
  );
};
