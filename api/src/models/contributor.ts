import { z } from 'zod';

export const ContributorRecord = z.object({
  contributor_id: z.number(),
  client_id: z.string()
});

export type ContributorRecord = z.infer<typeof ContributorRecord>;

export const ContributorMemberRecord = z.object({
  contributor_system_user_id: z.number(),
  contributor_id: z.number(),
  system_user_id: z.number()
});

export type ContributorMemberRecord = z.infer<typeof ContributorMemberRecord>;
