import { z } from 'zod';

export const SecurityRuleWithFeatureCount = z.object({
  security_rule_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  feature_count: z.number()
});

export type SecurityRuleWithFeatureCount = z.infer<typeof SecurityRuleWithFeatureCount>;

export interface SecuritySearchFilters {
  search?: string;
}
