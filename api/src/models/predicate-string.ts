import { z } from 'zod';
import { StringOperator } from './expression-tree';

/**
 * Typed predicate payload for string comparisons.
 *
 * Supports text matching and existence checks for string properties.
 */
export const PredicateString = z.object({
  predicate_string_id: z.number().int(),
  predicate_id: z.string().uuid(),
  value: z.string().max(250).nullable(),
  operator: StringOperator
});

export type PredicateString = z.infer<typeof PredicateString>;

export interface CreatePredicateString {
  predicate_id: string;
  value: string | null;
  operator: StringOperator;
}
