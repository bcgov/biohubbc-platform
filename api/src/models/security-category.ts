import { z } from 'zod';

export const SecurityCategoryWithRuleCount = z.object({
  security_category_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  rule_count: z.number()
});

export type SecurityCategoryWithRuleCount = z.infer<typeof SecurityCategoryWithRuleCount>;
