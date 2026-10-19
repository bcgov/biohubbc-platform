import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PolicyExpressionBuilder } from 'components/expression-builder/PolicyExpressionBuilder';
import { PageSection } from 'components/section/PageSection';
import { useFormikContext } from 'formik';
import { ITagRuleFormValues } from '../tag-rule-form-values';

/**
 * Required expression section of the tag rule form. Uses the policy expression builder, which commits each valid
 * change and reports an incomplete draft as an error that blocks saving; saving without an expression shows the
 * required error once submitted.
 *
 * @returns {JSX.Element} The expression section.
 */
export const TagRuleExpressionSection = () => {
  const { values, errors, submitCount, setFieldValue } = useFormikContext<ITagRuleFormValues>();
  const expressionError = submitCount > 0 ? (errors.expressionError ?? errors.expression) : undefined;

  return (
    <PageSection id="tag-rule-expression" label="Expression">
      <Stack gap={2} sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Submission upload tickets get the tag when a feature of the upload matches the expression. Data request
          tickets get the tag when the request&apos;s search refers to a property, or a taxon (including descendant
          taxa), that the expression also refers to.
        </Typography>
        <PolicyExpressionBuilder
          value={values.expression}
          onChange={(expression) => setFieldValue('expression', expression, false)}
          onValidationChange={(error) => setFieldValue('expressionError', error ?? undefined, false)}
        />
        {expressionError ? <FormHelperText error>{expressionError}</FormHelperText> : null}
      </Stack>
    </PageSection>
  );
};
