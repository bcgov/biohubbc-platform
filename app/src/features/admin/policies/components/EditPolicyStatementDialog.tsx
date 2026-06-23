import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { EditDialog } from 'components/dialog/EditDialog';
import { useFormikContext } from 'formik';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import yup from 'utils/YupSchema';
import { PolicyExpression } from './PolicyExpression';

export interface IEditPolicyStatementFormValues {
  effect: 'allow' | 'deny';
  submission_feature_urn: string;
  expression: ExpressionTreeExpression | null;
  expression_error?: string;
}

export const EditPolicyStatementFormInitialValues: IEditPolicyStatementFormValues = {
  effect: 'allow',
  submission_feature_urn: 'urn:*:*:*',
  expression: null,
  expression_error: undefined
};

export const EditPolicyStatementFormYupSchema = yup.object().shape({
  effect: yup.mixed<'allow' | 'deny'>().oneOf(['allow', 'deny']).required('Statement effect is required'),
  submission_feature_urn: yup
    .string()
    .required('Policy URN is required')
    .matches(
      /^urn:(\*|\d+):(\*|[a-zA-Z0-9_]+):(\*|[^:]+)$/,
      'Invalid Policy URN format. Expected: urn:<submissionId>:<featureType>:<featureId>'
    ),
  expression: yup.mixed<ExpressionTreeExpression>().nullable().required('Expression is required'),
  expression_error: yup
    .string()
    .optional()
    .test('valid-expression-builder-draft', 'Policy expression is invalid', (value) => !value)
});

interface IEditPolicyStatementDialogProps {
  open: boolean;
  isLoading: boolean;
  initialValues?: IEditPolicyStatementFormValues;
  mode?: 'create' | 'edit';
  dialogTitle?: string;
  dialogSaveButtonLabel?: string;
  onCancel: () => void;
  onSave: (values: IEditPolicyStatementFormValues) => void;
}

/**
 * Dialog for creating or editing one policy statement.
 *
 * @param {IEditPolicyStatementDialogProps} props
 * @returns {JSX.Element}
 */
export const EditPolicyStatementDialog = (props: IEditPolicyStatementDialogProps) => {
  const {
    open,
    isLoading,
    initialValues,
    mode = 'create',
    dialogTitle,
    dialogSaveButtonLabel,
    onCancel,
    onSave
  } = props;
  const isEditMode = mode === 'edit';

  return (
    <EditDialog<IEditPolicyStatementFormValues>
      isLoading={isLoading}
      dialogTitle={dialogTitle ?? (isEditMode ? 'Edit Statement' : 'Create Statement')}
      dialogSaveButtonLabel={dialogSaveButtonLabel ?? (isEditMode ? 'Save' : 'Create')}
      open={open}
      maxWidth="md"
      component={{
        element: <EditPolicyStatementForm />,
        initialValues: initialValues ?? EditPolicyStatementFormInitialValues,
        validationSchema: EditPolicyStatementFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};

/**
 * Policy statement form.
 *
 * @returns {JSX.Element}
 */
const EditPolicyStatementForm = () => {
  const { values, handleChange, handleSubmit, errors, touched, setFieldValue } =
    useFormikContext<IEditPolicyStatementFormValues>();

  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" gap={3}>
        <TextField
          name="effect"
          label="Effect"
          value={values.effect}
          onChange={handleChange}
          error={touched.effect && Boolean(errors.effect)}
          helperText={touched.effect && errors.effect}
          select
          required
          fullWidth>
          <MenuItem value="allow">Allow</MenuItem>
          <MenuItem value="deny">Deny</MenuItem>
        </TextField>

        <TextField
          name="submission_feature_urn"
          label="Policy URN"
          value={values.submission_feature_urn}
          onChange={handleChange}
          error={touched.submission_feature_urn && Boolean(errors.submission_feature_urn)}
          helperText={touched.submission_feature_urn && errors.submission_feature_urn}
          required
          fullWidth
        />

        <PolicyExpression
          value={values.expression ?? undefined}
          onChange={(expression) => setFieldValue('expression', expression, false)}
          onValidationChange={(error) => setFieldValue('expression_error', error ?? undefined, false)}
        />
      </Box>
    </form>
  );
};
