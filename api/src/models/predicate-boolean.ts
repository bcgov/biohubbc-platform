import { z } from 'zod';
import { BooleanOperator } from './expression-tree';

/**
 * Typed predicate payload for boolean conditions.
 *
 * Supports boolean equality and existence checks.
 */
export const PredicateBoolean = z.object({
  predicate_boolean_id: z.number().int(),
  predicate_id: z.string().uuid(),
  value: z.boolean().nullable(),
  operator: BooleanOperator
});

export type PredicateBoolean = z.infer<typeof PredicateBoolean>;

export interface CreatePredicateBoolean {
  predicate_id: string;
  value: boolean | null;
  operator: BooleanOperator;
}
