import { z } from 'zod';

export const Policy = z.object({
  policy_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(1000).nullable()
});

export type Policy = z.infer<typeof Policy>;

export interface CreatePolicy {
  name: string;
  description?: string;
}

export interface UpdatePolicy {
  name?: string;
  description?: string;
  record_end_date?: string;
}
