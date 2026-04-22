import { z } from 'zod';
import { FEATURE_PROPERTY_TYPE } from './feature-property';

/**
 * Predicate anchor row tied to a feature type property.
 *
 * The typed predicate value is stored in one companion payload table.
 */
export const Predicate = z.object({
  predicate_id: z.string().uuid(),
  feature_type_property_id: z.number().int(),
  feature_property_type_id: z.number().int(),
  predicate_hash: z.string()
});

export type Predicate = z.infer<typeof Predicate>;

export type PredicateFeaturePropertyTypeName =
  | FEATURE_PROPERTY_TYPE.STRING
  | FEATURE_PROPERTY_TYPE.NUMBER
  | FEATURE_PROPERTY_TYPE.BOOLEAN
  | FEATURE_PROPERTY_TYPE.DATETIME
  | FEATURE_PROPERTY_TYPE.TAXON
  | FEATURE_PROPERTY_TYPE.SPATIAL
  | FEATURE_PROPERTY_TYPE.CODE;

export interface PredicateAnchorAttributes {
  feature_type_property_id: number;
  feature_property_type_name: PredicateFeaturePropertyTypeName;
}

export type PredicateResolveInput = PredicateAnchorAttributes & {
  predicate_hash: string;
};

export const ReadPredicateNodeRow = z.object({
  predicate_id: z.string().uuid(),
  payload_count: z.number().int().nullable(),
  predicate_node: z.unknown().nullable()
});

export type ReadPredicateNodeRow = z.infer<typeof ReadPredicateNodeRow>;
