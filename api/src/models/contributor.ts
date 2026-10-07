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
/** Administrative contributor fields, including ended records. */
export const AdministrativeContributor = Contributor.extend({
  description: z.string().nullable(),
  record_end_date: z.string().nullable()
});
export type AdministrativeContributor = z.infer<typeof AdministrativeContributor>;

export interface ContributorInput {
  clientId: string;
  description: string | null;
}

export interface ContributorFilters {
  keyword?: string;
  activeOnly?: boolean;
}
