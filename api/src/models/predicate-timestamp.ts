import { z } from 'zod';
import { TimestampOperator } from './expression-tree';

/**
 * Typed predicate payload for timestamp comparisons.
 *
 * Supports date-only, time-only, and combined temporal conditions.
 */
export const PredicateTimestamp = z.object({
  predicate_timestamp_id: z.number().int(),
  predicate_id: z.string().uuid(),
  date_value: z.string().nullable(),
  time_value: z.string().nullable(),
  operator: TimestampOperator
});

export type PredicateTimestamp = z.infer<typeof PredicateTimestamp>;

export interface CreatePredicateTimestamp {
  predicate_id: string;
  date_value: string | null;
  time_value: string | null;
  operator: TimestampOperator;
}
