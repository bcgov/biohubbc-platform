import { z } from 'zod';

export const SecurityCategoryRecord = z.object({
  security_category_id: z.number(),
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

export type SecurityCategoryRecord = z.infer<typeof SecurityCategoryRecord>;

export const SecurityCategoryWithRuleCount = z.object({
  security_category_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  rule_count: z.number()
});

export type SecurityCategoryWithRuleCount = z.infer<typeof SecurityCategoryWithRuleCount>;

export const SecurityCategory = z.object({
  security_category_id: z.number(),
  name: z.string(),
  description: z.string().nullable()
});

export type SecurityCategory = z.infer<typeof SecurityCategory>;

export interface CreateSecurityCategory {
  name: string;
  description: string;
}

export interface UpdateSecurityCategory {
  name: string;
  description: string;
}
