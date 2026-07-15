import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ICreatePolicyFormValues } from './PolicyForm.interface';

/**
 * Metadata-only create form. Policy status is assigned internally by the API.
 *
 * @returns {JSX.Element}
 */
export const CreatePolicyForm = () => {
  const { values, handleChange, handleSubmit, errors, touched } = useFormikContext<ICreatePolicyFormValues>();

  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" gap={3}>
        <TextField
          name="name"
          label="Policy Name"
          value={values.name}
          onChange={handleChange}
          error={touched.name && Boolean(errors.name)}
          helperText={touched.name && errors.name}
          required
          fullWidth
        />

        <TextField
          name="description"
          label="Description"
          value={values.description}
          onChange={handleChange}
          error={touched.description && Boolean(errors.description)}
          helperText={touched.description && errors.description}
          multiline
          rows={3}
          fullWidth
        />
      </Box>
    </form>
  );
};
