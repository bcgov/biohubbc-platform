import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { IAddPolicyFormValues } from 'interfaces/usePoliciesApi.interface';
import yup from 'utils/YupSchema';
import PolicyStatementsEditor from './PolicyStatementsEditor';

export const AddPolicyFormInitialValues: IAddPolicyFormValues = {
  name: '',
  description: '',
  statements: []
};

export const AddPolicyFormYupSchema = yup.object().shape({
  name: yup.string().required('Policy name is required'),
  description: yup.string(),
  statements: yup.array().of(
    yup.object().shape({
      effect: yup.string().oneOf(['allow', 'deny']).required('Effect is required'),
      submission_feature_urn: yup.string().required('Submission feature URN is required')
    })
  )
});

const AddPolicyForm: React.FC = () => {
  const { values, handleChange, handleSubmit, errors, touched } = useFormikContext<IAddPolicyFormValues>();

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

        <PolicyStatementsEditor />
      </Box>
    </form>
  );
};

export default AddPolicyForm;
