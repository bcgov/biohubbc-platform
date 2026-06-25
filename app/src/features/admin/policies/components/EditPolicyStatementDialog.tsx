import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { EditDialog } from 'components/dialog/EditDialog';
import CustomAutocomplete, { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import { useFormikContext } from 'formik';
import { ICreatePolicyStatementRequest, IPolicyExpression } from 'interfaces/usePoliciesApi.interface';
import yup from 'utils/YupSchema';

export const EditPolicyStatementFormInitialValues: ICreatePolicyStatementRequest = {
  effect: 'allow',
  submission_feature_urn: 'urn:*:*:*'
};

export const EditPolicyStatementFormYupSchema = yup.object().shape({
  effect: yup.mixed<'allow' | 'deny'>().oneOf(['allow', 'deny']).required('Statement effect is required'),
  submission_feature_urn: yup
    .string()
    .required('Policy URN is required')
    .matches(
      /^urn:(\*|\d+):(\*|\w+):(\*|[^:]+)$/,
      'Invalid Policy URN format. Expected: urn:<submissionId>:<featureType>:<featureId>'
    ),
  policy_expression_id: yup.string().nullable()
});

interface IEditPolicyStatementDialogProps {
  open: boolean;
  isLoading: boolean;
  policyExpressions: IPolicyExpression[];
  initialValues?: ICreatePolicyStatementRequest;
  mode?: 'create' | 'edit';
  dialogTitle?: string;
  dialogSaveButtonLabel?: string;
  onCancel: () => void;
  onSave: (values: ICreatePolicyStatementRequest) => void;
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
    policyExpressions,
    initialValues,
    mode = 'create',
    dialogTitle,
    dialogSaveButtonLabel,
    onCancel,
    onSave
  } = props;
  const isEditMode = mode === 'edit';

  return (
    <EditDialog<ICreatePolicyStatementRequest>
      isLoading={isLoading}
      dialogTitle={dialogTitle ?? (isEditMode ? 'Edit Statement' : 'Create Statement')}
      dialogSaveButtonLabel={dialogSaveButtonLabel ?? (isEditMode ? 'Save' : 'Create')}
      open={open}
      maxWidth="md"
      component={{
        element: <EditPolicyStatementForm policyExpressions={policyExpressions} />,
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
const EditPolicyStatementForm = ({ policyExpressions }: { policyExpressions: IPolicyExpression[] }) => {
  const { values, handleChange, handleSubmit, errors, touched, submitCount, setFieldTouched, setFieldValue } =
    useFormikContext<ICreatePolicyStatementRequest>();

  const policyExpressionOptions: ICustomAutocompleteOption<string>[] = policyExpressions.map((policyExpression) => ({
    label: policyExpression.name ?? policyExpression.policy_expression_id,
    value: policyExpression.policy_expression_id
  }));
  const selectedPolicyExpressionOption = policyExpressionOptions.find(
    (option) => option.value === values.policy_expression_id
  );
  const showPolicyExpressionError =
    Boolean(errors.policy_expression_id) && (Boolean(touched.policy_expression_id) || submitCount > 0);

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

        <CustomAutocomplete
          label="Expression"
          options={policyExpressionOptions}
          value={selectedPolicyExpressionOption ?? null}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, selectedOption) => option.value === selectedOption.value}
          onChange={(_event, selectedOption) => setFieldValue('policy_expression_id', selectedOption?.value ?? null)}
          onBlur={() => setFieldTouched('policy_expression_id', true)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Expression"
              error={showPolicyExpressionError}
              helperText={showPolicyExpressionError ? errors.policy_expression_id : undefined}
              fullWidth
            />
          )}
        />
      </Box>
    </form>
  );
};
