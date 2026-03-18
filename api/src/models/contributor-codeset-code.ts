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
