import { z } from 'zod';

export const ContributorSystemUser = z.object({
  contributor_system_user_id: z.number(),
  contributor_id: z.number(),
  system_user_id: z.number()
});

export type ContributorSystemUser = z.infer<typeof ContributorSystemUser>;

/** Administrative relationship fields with labels for both related records. */
export const AdministrativeContributorSystemUser = ContributorSystemUser.extend({
  client_id: z.string(),
  user_identifier: z.string(),
  display_name: z.string().nullable(),
  record_end_date: z.string().nullable()
});
export type AdministrativeContributorSystemUser = z.infer<typeof AdministrativeContributorSystemUser>;

export interface ContributorSystemUserInput {
  contributorId: number;
  systemUserId: number;
}

export interface ContributorSystemUserFilters {
  keyword?: string;
  activeOnly?: boolean;
  contributorId?: number;
}
