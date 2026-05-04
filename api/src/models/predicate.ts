import { z } from 'zod';

/**
 * Predicate anchor row tied to a feature property.
 *
 * The typed predicate value is stored in one companion payload table.
 */
export const Predicate = z.object({
  predicate_id: z.string().uuid(),
  feature_property_id: z.number().int(),
  feature_type_property_id: z.number().int().nullable(),
  feature_property_type_id: z.number().int(),
  predicate_hash: z.string()
});

export type Predicate = z.infer<typeof Predicate>;

export const ResolvedPredicateAnchor = Predicate.extend({
  inserted: z.boolean()
});

export type ResolvedPredicateAnchor = z.infer<typeof ResolvedPredicateAnchor>;

export type PredicateResolveInput = Pick<
  Predicate,
  'feature_property_id' | 'feature_type_property_id' | 'feature_property_type_id' | 'predicate_hash'
>;

export const ReadPredicateNodeRow = z.object({
  predicate_id: z.string().uuid(),
  payload_count: z.number().int().nullable(),
  predicate_node: z.unknown().nullable()
});

export type ReadPredicateNodeRow = z.infer<typeof ReadPredicateNodeRow>;
