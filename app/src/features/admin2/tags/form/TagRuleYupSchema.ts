import { TAG_RULE_DESCRIPTION_MAX_LENGTH, TAG_RULE_NAME_MAX_LENGTH } from 'constants/tag-rule';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import yup from 'utils/YupSchema';

export const TagRuleYupSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Name is required')
    .max(TAG_RULE_NAME_MAX_LENGTH, `Name must be ${TAG_RULE_NAME_MAX_LENGTH} characters or less`),
  description: yup
    .string()
    .nullable()
    .max(TAG_RULE_DESCRIPTION_MAX_LENGTH, `Description must be ${TAG_RULE_DESCRIPTION_MAX_LENGTH} characters or less`),
  expression: yup.mixed<ExpressionTreeExpression>().nullable().required('A complete expression is required')
});
