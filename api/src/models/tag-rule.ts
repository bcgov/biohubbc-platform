import { z } from 'zod';
import { ExpressionTree } from './expression-tree';
import { NormalizedExpressionTree } from './expression-tree-internal';

export const TagRule = z.object({
  tag_rule_id: z.string().uuid(),
  tag_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  is_enabled: z.boolean(),
  expression_id: z.string().uuid(),
  create_date: z.string()
});
export type TagRule = z.infer<typeof TagRule>;

/**
 * Tag rule with its expression read back as an API-shaped tree, for editing.
 */
export interface TagRuleDetail extends TagRule {
  expression: ExpressionTree;
}

/**
 * Create or update tag rule request. The rule's tag comes from the route.
 */
export interface TagRuleRequest {
  name: string;
  description: string | null;
  expression: ExpressionTree;
}

/**
 * Tag rule columns written on insert and update, with the rule's expression stored as an expression id.
 */
export interface TagRulePayload {
  name: string;
  description: string | null;
  expression_id: string;
}

/**
 * A ticket's active submission upload, the boundary for evaluating rule expressions against its features.
 */
export const TicketSubmissionUploadScope = z.object({
  submission_id: z.number(),
  submission_upload_id: z.string().uuid()
});
export type TicketSubmissionUploadScope = z.infer<typeof TicketSubmissionUploadScope>;

/**
 * A tag applied to a ticket by the rule that matched it.
 */
export interface RuleTicketTag {
  tag_id: string;
  tag_rule_id: string;
}

export const TagRuleId = z.object({
  tag_rule_id: z.string().uuid()
});
export type TagRuleId = z.infer<typeof TagRuleId>;

/**
 * An enabled tag rule ready to evaluate: its stored expression id, for matching data request expressions in SQL, and
 * its expression normalized for evaluating submission upload features.
 */
export interface TagRuleEvaluation {
  tag_rule_id: string;
  expression_id: string;
  expression: NormalizedExpressionTree;
}
