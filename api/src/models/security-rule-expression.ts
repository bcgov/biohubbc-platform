import { z } from 'zod';

/**
 * Join model linking a security rule to its expression tree.
 *
 * Used to evaluate rule conditions against submission features.
 */
export const SecurityRuleExpression = z.object({
  security_rule_expression_id: z.string().uuid(),
  security_rule_id: z.number().int(),
  expression_id: z.string().uuid()
});

export type SecurityRuleExpression = z.infer<typeof SecurityRuleExpression>;

export interface CreateSecurityRuleExpression {
  security_rule_id: number;
  expression_id: string;
}
