import { ApiPaginationResponseParams } from 'types/pagination';
import { ExpressionTreeExpression } from './expression.interface';

/**
 * A tag rule as listed on its tag's page. A rule is an expression that applies its tag: a submission upload ticket
 * gets the tag when a feature of the upload matches the expression, evaluated when the upload's features are indexed;
 * a data request ticket gets the tag when the request's search refers to a property, or a taxon (including descendant
 * taxa), that the rule's expression also refers to, evaluated when the request is created. Rules only add tags, never
 * one the ticket has ever had (a removed tag stays removed), and do not apply to existing tickets.
 */
export interface ITagRule {
  tag_rule_id: string;
  tag_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  expression_id: string;
  create_date: string;
}

/** A tag rule with its expression, for editing. */
export interface ITagRuleDetail extends ITagRule {
  expression: ExpressionTreeExpression;
}

export interface IGetTagRulesResponse {
  tag_rules: ITagRule[];
  pagination: ApiPaginationResponseParams;
}

/**
 * A tag rule's complete editable fields, sent when creating a rule or replacing an existing one. New rules are
 * created enabled; whether a rule is enabled is changed on its own.
 */
export interface ITagRuleRequest {
  name: string;
  description: string | null;
  /** Expression that upload features, or a data request's referenced properties and taxa, are matched against. */
  expression: ExpressionTreeExpression;
}

/** Whether a tag rule applies its tag. */
export interface ITagRuleEnabledRequest {
  isEnabled: boolean;
}
