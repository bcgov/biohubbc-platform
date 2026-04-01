import { z } from 'zod';
import { CodeOperator } from './expression-tree';

/**
 * Typed predicate payload for controlled code comparisons.
 *
 * Stores contributor codeset references used in code-based filters.
 */
export const PredicateCode = z.object({
  predicate_code_id: z.number().int(),
  predicate_id: z.string().uuid(),
  contributor_codeset_code_id: z.number().int().nullable(),
  operator: CodeOperator
});

export type PredicateCode = z.infer<typeof PredicateCode>;

export interface CreatePredicateCode {
  predicate_id: string;
  contributor_codeset_code_id: number | null;
  operator: CodeOperator;
}
