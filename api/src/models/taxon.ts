import { z } from 'zod';

export const ItisTsn = z.number().int().positive().max(2147483647);
export type ItisTsn = z.infer<typeof ItisTsn>;
export const ItisTsnLookupValue = z.union([
  ItisTsn,
  z.string().trim().regex(/^\d+$/).pipe(z.coerce.number()).pipe(ItisTsn)
]);

export const TaxonRecord = z.object({
  taxon_id: z.number(),
  itis_tsn: ItisTsn,
  parent_itis_tsn: ItisTsn.nullable(),
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
  itis_tsn: ItisTsn;
  itis_scientific_name: string;
  rank: string | null;
  common_name: string | null;
  itis_data: Record<string, unknown>;
  itis_update_date: string;
};

export type TaxonParentLinkRecord = {
  itis_tsn: ItisTsn;
  parent_itis_tsn: ItisTsn;
};

export type TaxonRankPatchRecord = {
  itis_tsn: ItisTsn;
  rank: string | null;
};

export type FindTaxonFilters = {
  itis_tsn?: ItisTsn;
  itis_scientific_name?: string;
};
