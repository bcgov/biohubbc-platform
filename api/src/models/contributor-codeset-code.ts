import { z } from 'zod';

export const ContributorCodesetCodeSchema = z.object({
  contributor_codeset_code_id: z.number().int(),
  contributor_codeset_id: z.number().int(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  external_id: z.string().nullable()
});

export type ContributorCodesetCode = z.infer<typeof ContributorCodesetCodeSchema>;

export interface CreateContributorCodesetCode {
  contributor_codeset_id: number;
  key: string;
  label: string;
  description?: string | null;
  external_id?: string | null;
}

/** Administrative code value fields with the owning code category's label, including ended values. */
export const AdministrativeContributorCodesetCodeSchema = ContributorCodesetCodeSchema.extend({
  codeset_label: z.string(),
  record_end_date: z.string().nullable()
});

export type AdministrativeContributorCodesetCode = z.infer<typeof AdministrativeContributorCodesetCodeSchema>;
