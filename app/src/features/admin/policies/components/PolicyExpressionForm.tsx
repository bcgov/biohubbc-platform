import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { PolicyExpressionBuilder } from 'components/expression-builder/PolicyExpressionBuilder';
import { useFormikContext } from 'formik';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import yup from 'utils/YupSchema';

export interface IPolicyExpressionFormValues {
  name: string;
  description: string;
  expression: ExpressionTreeExpression | null;
  expression_error?: string;
}

export const PolicyExpressionFormInitialValues: IPolicyExpressionFormValues = {
  name: '',
  description: '',
  expression: null,
  expression_error: undefined
};

export const PolicyExpressionFormYupSchema = yup.object().shape({
  name: yup.string().required('Name is required'),
  description: yup.string(),
  expression: yup.mixed<ExpressionTreeExpression>().nullable().required('Expression is required'),
  expression_error: yup
    .string()
    .optional()
    .test('valid-expression-builder-draft', 'Policy expression is invalid', (value) => !value)
});

/**
 * Policy expression form.
 *
 * @returns {JSX.Element}
 */
export const PolicyExpressionForm = () => {
  const { values, handleChange, handleSubmit, errors, touched, setFieldValue } =
    useFormikContext<IPolicyExpressionFormValues>();

  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" gap={2}>
        <TextField
          name="name"
          label="Name"
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

        <PolicyExpressionBuilder
          value={values.expression ?? undefined}
          onChange={(expression) => setFieldValue('expression', expression, false)}
          onValidationChange={(error) => setFieldValue('expression_error', error ?? undefined, false)}
        />
      </Box>
    </form>
  );
};
