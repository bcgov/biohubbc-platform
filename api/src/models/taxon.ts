import { z } from 'zod';

export const TaxonRecord = z.object({
  taxon_id: z.number(),
  itis_tsn: z.number(),
  parent_itis_tsn: z.number().nullable(),
  parent_taxon_id: z.number().nullable(),
  bc_taxon_code: z.string().nullable(),
  itis_scientific_name: z.string(),
  rank: z.string().nullable(),
  common_name: z.string().nullable(),
  itis_data: z.any(),
  itis_update_date: z.string()
});

export type TaxonRecord = z.infer<typeof TaxonRecord>;

export type AddItisTaxonRecord = {
  itis_tsn: number;
  itis_scientific_name: string;
  rank: string | null;
  common_name: string | null;
  itis_data: Record<string, unknown>;
  itis_update_date: string;
};

export type TaxonParentLinkRecord = {
  itis_tsn: number;
  parent_itis_tsn: number;
};

export type TaxonRankPatchRecord = {
  itis_tsn: number;
  rank: string | null;
};
