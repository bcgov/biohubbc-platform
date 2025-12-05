import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PolicyAutocompleteContextProvider } from 'contexts/policyAutocompleteContext';
import { useFormikContext } from 'formik';
import { useCallback } from 'react';
import yup from 'utils/YupSchema';
import { PolicyJsonEditor } from './PolicyJsonEditor';
import { defaultPolicyDocument, validatePolicyJson } from '../utils/policyTransform';

/**
 * Form values for creating or editing a policy.
 * Used with Formik for form state management.
 */
export interface IAddPolicyFormValues {
  /** Display name for the policy */
  name: string;
  /** Optional description of the policy's purpose */
  description: string;
  /** JSON string containing the policy document (IPolicyDocument structure) */
  policy_json: string;
}

/**
 * Default initial values for a new policy form.
 */
export const AddPolicyFormInitialValues: IAddPolicyFormValues = {
  name: '',
  description: '',
  policy_json: JSON.stringify(defaultPolicyDocument, null, 2)
};

/**
 * Yup validation schema for the policy form.
 * Validates name is required and policy_json is valid JSON with correct structure.
 */
export const AddPolicyFormYupSchema = yup.object().shape({
  name: yup.string().required('Policy name is required'),
  description: yup.string(),
  policy_json: yup
    .string()
    .required('Policy document is required')
    .test('valid-policy', function (value) {
      const result = validatePolicyJson(value || '');
      if (!result.valid) {
        return this.createError({ message: result.error });
      }
      return true;
    })
});

/**
 * Form component for creating or editing a policy.
 *
 * Must be used within a Formik context (wrapped by EditDialog or similar).
 * Includes fields for name, description, and a JSON policy document editor.
 * The PolicyJsonEditor is wrapped in PolicyAutocompleteContextProvider for autocomplete support.
 *
 * @returns {React.ReactElement} The policy form
 */
export const AddPolicyForm: React.FC = () => {
  const { values, handleChange, handleSubmit, errors, touched, setFieldValue, setFieldError } =
    useFormikContext<IAddPolicyFormValues>();

  /**
   * Handle Monaco validation state changes.
   * Sets a Formik field error when Monaco has validation errors,
   * which prevents form submission via Formik's isValid check.
   */
  const handleValidationChange = useCallback(
    (hasErrors: boolean) => {
      if (hasErrors) {
        setFieldError('policy_json', 'Policy document has validation errors');
      } else if (errors.policy_json === 'Policy document has validation errors') {
        // Clear only our Monaco-set error, not Yup validation errors
        setFieldError('policy_json', undefined);
      }
    },
    [setFieldError, errors.policy_json]
  );

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
          <PolicyAutocompleteContextProvider>
            <PolicyJsonEditor
              value={values.policy_json}
              onChange={(val) => setFieldValue('policy_json', val)}
              error={touched.policy_json ? (errors.policy_json as string) : undefined}
              onValidationChange={handleValidationChange}
            />
          </PolicyAutocompleteContextProvider>
        </Box>
      </Box>
    </form>
  );
};
