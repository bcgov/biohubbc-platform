import Stack from '@mui/material/Stack';
import { TagRuleDetailsSection } from './section/TagRuleDetailsSection';
import { TagRuleExpressionSection } from './section/TagRuleExpressionSection';

/**
 * Tag rule fields: the rule's tag, name, description and state, and its required expression. Rendered inside the tag
 * rule page's Formik.
 *
 * @returns {JSX.Element} The tag rule form sections.
 */
export const TagRuleForm = () => {
  return (
    <Stack gap={3}>
      <TagRuleDetailsSection />
      <TagRuleExpressionSection />
    </Stack>
  );
};
