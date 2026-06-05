import { z } from 'zod';

export const SecurityRuleRecord = z.object({
  security_rule_id: z.number(),
  policy_id: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SecurityRuleRecord = z.infer<typeof SecurityRuleRecord>;

export const SecurityRuleAndCategory = z.object({
  security_rule_id: z.number(),
  policy_id: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  security_category_id: z.number(),
  category_name: z.string(),
  category_description: z.string(),
  category_record_effective_date: z.string(),
  category_record_end_date: z.string().nullable()
});

export type SecurityRuleAndCategory = z.infer<typeof SecurityRuleAndCategory>;

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
