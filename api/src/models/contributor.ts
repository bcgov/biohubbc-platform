import { z } from 'zod';

export const Contributor = z.object({
  contributor_id: z.number(),
  client_id: z.string()
});

export type Contributor = z.infer<typeof Contributor>;

/** Active contributor and the caller's current membership, resolved together. */
export const ContributorMembership = z.object({
  contributor_id: z.number(),
  is_member: z.boolean()
});

export type ContributorMembership = z.infer<typeof ContributorMembership>;
