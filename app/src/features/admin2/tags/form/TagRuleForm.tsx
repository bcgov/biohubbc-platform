import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import { PolicyExpressionBuilder } from 'components/expression-builder/PolicyExpressionBuilder';
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { TAG_RULE_DESCRIPTION_MAX_LENGTH, TAG_RULE_NAME_MAX_LENGTH } from 'constants/tag-rule';
import { useFormikContext } from 'formik';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';

export interface ITagRuleFormValues {
  name: string;
  description: string | null;
  /** The rule's complete expression; null while the builder's draft is empty or incomplete, which blocks saving. */
  expression: ExpressionTreeExpression | null;
}

/**
 * Tag rule fields: name, description and the required expression. Rendered inside an `EditDialog`, which owns the
 * Formik state.
 *
 * The expression uses the policy expression builder. The form holds only a complete expression: each valid change is
 * committed, and an incomplete draft clears it, so the expression's required check blocks saving until the draft is
 * complete. The error shows once a save is attempted.
 *
 * @returns {JSX.Element} The tag rule form fields.
 */
export const TagRuleForm = () => {
  const { values, errors, submitCount, setFieldValue } = useFormikContext<ITagRuleFormValues>();
  const expressionError = submitCount > 0 ? errors.expression : undefined;

  return (
    <Stack gap={2} sx={{ pt: 1 }}>
      <CustomTextFieldFormik
        label="Name"
        name="name"
        required
        slotProps={{ htmlInput: { maxLength: TAG_RULE_NAME_MAX_LENGTH } }}
      />
      <CustomTextFieldFormik
        label="Description"
        name="description"
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: TAG_RULE_DESCRIPTION_MAX_LENGTH } }}
      />
      <PolicyExpressionBuilder
        value={values.expression ?? undefined}
        onChange={(expression) => setFieldValue('expression', expression, false)}
        onValidationChange={(error) => {
          // The builder only emits complete expressions, so an incomplete draft leaves no expression to save.
          if (error) {
            setFieldValue('expression', null, false);
          }
        }}
      />
      {expressionError ? <FormHelperText error>{expressionError}</FormHelperText> : null}
    </Stack>
  );
};
