import { TAG_RULE_DESCRIPTION_MAX_LENGTH, TAG_RULE_NAME_MAX_LENGTH } from 'constants/tag-rule';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ITagSummary } from 'interfaces/useTagsApi.interface';
import yup from 'utils/YupSchema';

export const TagRuleYupSchema = yup.object().shape({
  tag: yup.mixed<ITagSummary>().nullable().required('Tag is required'),
  name: yup
    .string()
    .trim()
    .required('Name is required')
    .max(TAG_RULE_NAME_MAX_LENGTH, `Name must be ${TAG_RULE_NAME_MAX_LENGTH} characters or less`),
  description: yup
    .string()
    .nullable()
    .max(TAG_RULE_DESCRIPTION_MAX_LENGTH, `Description must be ${TAG_RULE_DESCRIPTION_MAX_LENGTH} characters or less`),
  isEnabled: yup.boolean().required(),
  expression: yup.mixed<ExpressionTreeExpression>().nullable().required('Expression is required'),
  expressionError: yup
    .string()
    .optional()
    .test('valid-expression-builder-draft', 'Expression is invalid', (value) => !value)
});
