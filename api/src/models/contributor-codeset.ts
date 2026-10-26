import { z } from 'zod';

export const ContributorCodesetSchema = z.object({
  contributor_codeset_id: z.number().int(),
  contributor_id: z.number().int(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  external_id: z.string().nullable()
});

export type ContributorCodeset = z.infer<typeof ContributorCodesetSchema>;

export interface CreateContributorCodeset {
  contributor_id: number;
  key: string;
  label: string;
  description?: string | null;
  external_id?: string | null;
}

/** Administrative code category fields, including ended categories. */
export const AdministrativeContributorCodesetSchema = ContributorCodesetSchema.extend({
  record_end_date: z.string().nullable()
});

export type AdministrativeContributorCodeset = z.infer<typeof AdministrativeContributorCodesetSchema>;

/** A code category, scoped to the contributor that owns it. */
export interface ContributorCodesetScope {
  contributorId: number;
  contributorCodesetId: number;
}
