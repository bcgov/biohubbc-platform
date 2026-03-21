import { z } from 'zod';

export const ContributorSystemUser = z.object({
  contributor_system_user_id: z.number(),
  contributor_id: z.number(),
  system_user_id: z.number()
});

export type ContributorSystemUser = z.infer<typeof ContributorSystemUser>;
