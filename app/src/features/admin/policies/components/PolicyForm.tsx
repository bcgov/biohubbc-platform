import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import CustomAutocomplete, { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import { useFormikContext } from 'formik';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import yup from 'utils/YupSchema';

export interface IPolicyFormValues {
  name: string;
  description: string;
  status: PolicyStatus;
}

export const PolicyFormInitialValues: IPolicyFormValues = {
  name: '',
  description: '',
  status: PolicyStatus.REQUESTED
};

const policyStatusOptions: ICustomAutocompleteOption<PolicyStatus>[] = Object.values(PolicyStatus).map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1)
}));

export const PolicyFormYupSchema = yup.object().shape({
  name: yup.string().required('Policy name is required'),
  description: yup.string(),
  status: yup.mixed<PolicyStatus>().required('Status is required')
});

/**
 * Metadata-only policy form used by policy table create/edit dialogs.
 *
 * @returns {JSX.Element}
 */
export const PolicyForm = () => {
  const { values, handleChange, handleSubmit, errors, touched, setFieldValue, setFieldTouched } =
    useFormikContext<IPolicyFormValues>();
  const selectedStatus = policyStatusOptions.find((option) => option.value === values.status) ?? null;

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

        <CustomAutocomplete
          label="Status"
          options={policyStatusOptions}
          value={selectedStatus}
          onChange={(_event, option) => setFieldValue('status', option?.value ?? '')}
          onBlur={() => setFieldTouched('status', true)}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          renderInput={(params) => (
            <TextField
              {...params}
              name="status"
              label="Status"
              error={touched.status && Boolean(errors.status)}
              helperText={touched.status && errors.status}
              required
            />
          )}
        />
      </Box>
    </form>
  );
};
