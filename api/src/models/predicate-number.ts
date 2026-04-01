import { z } from 'zod';
import { NumberOperator } from './expression-tree';

/**
 * Typed predicate payload for numeric comparisons.
 *
 * Supports range, equality, and existence checks on number properties.
 */
export const PredicateNumber = z.object({
  predicate_number_id: z.number().int(),
  predicate_id: z.string().uuid(),
  value: z.number().nullable(),
  operator: NumberOperator
});

export type PredicateNumber = z.infer<typeof PredicateNumber>;

export interface CreatePredicateNumber {
  predicate_id: string;
  value: number | null;
  operator: NumberOperator;
}
