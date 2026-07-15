import { z } from 'zod';

export const PolicyStatus = z.enum(['requested', 'reviewed', 'approved', 'denied']);
export type PolicyStatus = z.infer<typeof PolicyStatus>;

export const Policy = z.object({
  policy_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(1000).nullable(),
  status: PolicyStatus
});
export type Policy = z.infer<typeof Policy>;

export const CreatePolicy = Policy.pick({
  name: true,
  status: true
}).extend({
  description: z.string().max(1000).optional(),
  record_end_date: z.string().optional()
});
export type CreatePolicy = z.infer<typeof CreatePolicy>;

export const UpdatePolicy = CreatePolicy.partial();
export type UpdatePolicy = z.infer<typeof UpdatePolicy>;
