import { z } from 'zod';
import { GeometryOperator } from './expression-tree';

/**
 * Typed predicate payload for spatial comparisons.
 *
 * Carries a geometry object used by spatial operators.
 */
export const PredicateGeometry = z.object({
  predicate_geometry_id: z.number().int(),
  predicate_id: z.string().uuid(),
  value: z.record(z.any()).nullable(),
  operator: GeometryOperator
});

export type PredicateGeometry = z.infer<typeof PredicateGeometry>;

export interface CreatePredicateGeometry {
  predicate_id: string;
  value: Record<string, any> | null;
  operator: GeometryOperator;
}
