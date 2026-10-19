import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ITagRuleDetail, ITagRuleRequest } from 'interfaces/useTagRulesApi.interface';
import { ITagSummary } from 'interfaces/useTagsApi.interface';

export interface ITagRuleFormValues {
  /** The tag the rule applies; kept whole so the picker can show it whether or not the tag search matches it. */
  tag: ITagSummary | null;
  name: string;
  description: string | null;
  isEnabled: boolean;
  /** The rule's expression; null until one is built, which blocks saving. */
  expression: ExpressionTreeExpression | null;
  /** The expression builder's error for an incomplete draft, which blocks saving. */
  expressionError?: string;
}

export const CreateTagRuleFormInitialValues: ITagRuleFormValues = {
  tag: null,
  name: '',
  description: null,
  isEnabled: true,
  expression: null
};

/**
 * The form values of an existing tag rule.
 *
 * @param {ITagRuleDetail} tagRule The rule being edited.
 * @returns {ITagRuleFormValues} The rule's form values.
 */
export const getTagRuleFormValues = (tagRule: ITagRuleDetail): ITagRuleFormValues => {
  return {
    tag: { tag_id: tagRule.tag_id, name: tagRule.tag_name, color: tagRule.tag_color },
    name: tagRule.name,
    description: tagRule.description,
    isEnabled: tagRule.is_enabled,
    expression: tagRule.expression
  };
};

/**
 * The create or update request for validated form values: trimmed name, a blank description as null, and the
 * expression as built.
 *
 * @param {ITagRuleFormValues} values The submitted form values; the form schema requires a tag and an expression.
 * @throws {Error} When the values have no tag or expression, which validation prevents.
 * @returns {ITagRuleRequest} The tag rule request.
 */
export const getTagRuleRequest = (values: ITagRuleFormValues): ITagRuleRequest => {
  if (!values.tag || !values.expression) {
    throw new Error('Tag and expression are required');
  }

  return {
    tagId: values.tag.tag_id,
    name: values.name.trim(),
    description: values.description?.trim() || null,
    isEnabled: values.isEnabled,
    expression: values.expression
  };
};
