import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { UrnEditorContextProvider } from 'contexts/urnEditorContext';
import { useFormikContext } from 'formik';
import yup from 'utils/YupSchema';
import PolicyJsonEditor from './PolicyJsonEditor';
import { defaultPolicyDocument, validatePolicyJson } from '../utils/policyTransform';

/**
 * Policy form values (for Formik) - JSON-based.
 */
export interface IAddPolicyFormValues {
  name: string;
  description: string;
  policy_json: string;
}

export const AddPolicyFormInitialValues: IAddPolicyFormValues = {
  name: '',
  description: '',
  policy_json: JSON.stringify(defaultPolicyDocument, null, 2)
};

export const AddPolicyFormYupSchema = yup.object().shape({
  name: yup.string().required('Policy name is required'),
  description: yup.string(),
  policy_json: yup
    .string()
    .required('Policy document is required')
    .test('valid-policy', function (value) {
      const error = validatePolicyJson(value || '');
      if (error) {
        return this.createError({ message: error });
      }
      return true;
    })
});

const AddPolicyForm: React.FC = () => {
  const { values, handleChange, handleSubmit, errors, touched, setFieldValue } =
    useFormikContext<IAddPolicyFormValues>();

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

        <Box>
          <Typography variant="h6" mb={1}>
            Policy Document
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Define policy statements using JSON. Use the format:{' '}
            <code>urn:&lt;submissionId&gt;:&lt;featureType&gt;:&lt;featureId&gt;</code> for resources. Use{' '}
            <code>*</code> as a wildcard.
          </Typography>
          <UrnEditorContextProvider>
            <PolicyJsonEditor
              value={values.policy_json}
              onChange={(val) => setFieldValue('policy_json', val)}
              error={touched.policy_json ? (errors.policy_json as string) : undefined}
            />
          </UrnEditorContextProvider>
        </Box>
      </Box>
    </form>
  );
};

export default AddPolicyForm;
