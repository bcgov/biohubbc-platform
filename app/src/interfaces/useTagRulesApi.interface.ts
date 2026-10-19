import { ExpressionTreeExpression } from './expression.interface';

/**
 * A tag rule as listed, with the display fields of the tag it applies. A rule is a tag plus an expression: a
 * submission upload ticket gets the tag when a feature of the upload matches the expression, evaluated when the
 * upload finishes processing; a data request ticket gets the tag when the request's search expression refers to a
 * property, or a taxon (including descendant taxa), that the rule's expression also refers to, evaluated when the
 * request is created. Rules only add tags, never one the ticket has ever had (a removed tag stays removed), and do
 * not apply to existing tickets.
 */
export interface ITagRule {
  tag_rule_id: string;
  tag_id: string;
  tag_name: string;
  /** Hex color, `#RRGGBB`. */
  tag_color: string;
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
}

/** A tag rule's complete editable fields, sent when creating a rule or replacing an existing one. */
export interface ITagRuleRequest {
  tagId: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  /** Expression that upload features, or a data request's referenced properties and taxa, are matched against. */
  expression: ExpressionTreeExpression;
}
