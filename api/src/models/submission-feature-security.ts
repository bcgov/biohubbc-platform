import { z } from 'zod';

export const SubmissionFeatureSecurityRecord = z.object({
  submission_feature_security_id: z.number(),
  submission_feature_id: z.number(),
  security_rule_id: z.number(),
  status: z.enum(['draft', 'screened']),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SubmissionFeatureSecurityRecord = z.infer<typeof SubmissionFeatureSecurityRecord>;

export const SubmissionFeatureSecurityRulesSummary = z.object({
  rules: z.array(
    z.object({
      security_rule_id: z.number(),
      count: z.number()
    })
  )
});

export type SubmissionFeatureSecurityRulesSummary = z.infer<typeof SubmissionFeatureSecurityRulesSummary>;
