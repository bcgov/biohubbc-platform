import { z } from 'zod';
import { TaxonOperator } from './expression-tree';

/**
 * Typed predicate payload for taxonomic comparisons.
 *
 * Supports direct and hierarchical matching against taxon identifiers.
 */
export const PredicateTaxon = z.object({
  predicate_taxon_id: z.number().int(),
  predicate_id: z.string().uuid(),
  taxon_id: z.number().int().nullable(),
  operator: TaxonOperator
});

export type PredicateTaxon = z.infer<typeof PredicateTaxon>;

export interface CreatePredicateTaxon {
  predicate_id: string;
  taxon_id: number | null;
  operator: TaxonOperator;
}
