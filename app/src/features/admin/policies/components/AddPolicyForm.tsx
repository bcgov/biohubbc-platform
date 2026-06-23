import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { PolicyExpressionBuilder } from 'components/expression-builder/PolicyExpressionBuilder';
import { useFormikContext } from 'formik';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { PolicyStatus } from 'interfaces/usePoliciesApi.interface';
import yup from 'utils/YupSchema';

/**
 * Form values for creating or editing a policy.
 * Used with Formik for form state management.
 */
export interface IAddPolicyFormValues {
  /** Display name for the policy */
  name: string;
  /** Optional description of the policy's purpose */
  description: string;
  /** Lifecycle status for the policy */
  status: PolicyStatus;
  /** Statement effect for the single editable policy statement */
  statement_effect: 'allow' | 'deny';
  /** Resource URN for the single editable policy statement */
  submission_feature_urn: string;
  /** Expression tree committed by the expression builder */
  expression: ExpressionTreeExpression | null;
  /** Current expression-builder validation error, if any */
  expression_error?: string;
}

/**
 * Default initial values for a new policy form.
 */
export const AddPolicyFormInitialValues: IAddPolicyFormValues = {
  name: '',
  description: '',
  status: PolicyStatus.REQUESTED,
  statement_effect: 'allow',
  submission_feature_urn: 'urn:*:*:*',
  expression: null,
  expression_error: undefined
};

/**
 * Yup validation schema for the policy form.
 * Validates policy metadata and the single statement target.
 */
export const AddPolicyFormYupSchema = yup.object().shape({
  name: yup.string().required('Policy name is required'),
  description: yup.string(),
  status: yup.mixed<PolicyStatus>().required('Status is required'),
  statement_effect: yup.mixed<'allow' | 'deny'>().oneOf(['allow', 'deny']).required('Statement effect is required'),
  submission_feature_urn: yup
    .string()
    .required('Resource URN is required')
    .matches(
      /^urn:(\*|\d+):(\*|[a-zA-Z0-9_]+):(\*|[^:]+)$/,
      'Invalid Resource URN format. Expected: urn:<submissionId>:<featureType>:<featureId>'
    ),
  expression: yup.mixed<ExpressionTreeExpression>().nullable(),
  expression_error: yup
    .string()
    .optional()
    .test('valid-expression-builder-draft', 'Policy expression is invalid', (value) => !value)
});

/**
 * Form component for creating or editing a policy.
 *
 * Must be used within a Formik context (wrapped by EditDialog or similar).
 * Includes fields for metadata, the single policy statement, and an expression builder.
 *
 * @returns {React.ReactElement} The policy form
 */
export const AddPolicyForm = () => {
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

        <TextField
          name="status"
          label="Status"
          value={values.status}
          onChange={handleChange}
          error={touched.status && Boolean(errors.status)}
          helperText={touched.status && errors.status}
          select
          required
          fullWidth>
          {Object.values(PolicyStatus).map((status) => (
            <MenuItem key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          name="statement_effect"
          label="Effect"
          value={values.statement_effect}
          onChange={handleChange}
          error={touched.statement_effect && Boolean(errors.statement_effect)}
          helperText={touched.statement_effect && errors.statement_effect}
          select
          required
          fullWidth>
          <MenuItem value="allow">Allow</MenuItem>
          <MenuItem value="deny">Deny</MenuItem>
        </TextField>

        <TextField
          name="submission_feature_urn"
          label="Resource"
          value={values.submission_feature_urn}
          onChange={handleChange}
          error={touched.submission_feature_urn && Boolean(errors.submission_feature_urn)}
          helperText={touched.submission_feature_urn && errors.submission_feature_urn}
          required
          fullWidth
        />

        <Box>
          <PolicyExpressionBuilder
            value={values.expression ?? undefined}
            onChange={(expression) => setFieldValue('expression', expression, false)}
            onValidationChange={(error) => setFieldValue('expression_error', error ?? undefined, false)}
          />
        </Box>
      </Box>
    </form>
  );
};
