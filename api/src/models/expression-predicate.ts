import { z } from 'zod';

/**
 * Structural predicate operator schema for public expression predicates.
 *
 * This Zod object is the runtime validator used by request/response schemas, while the exported
 * `PredicateOperator` TypeScript type is inferred from the same object so compile-time types and runtime validation
 * stay aligned. Keep this schema limited to operator shape/identity; property-specific operator compatibility belongs
 * in semantic validation after feature property metadata has been resolved.
 */
export const PredicateOperator = z.enum([
  'Equals',
  'NotEquals',
  'Like',
  'ILike',
  'StartsWith',
  'EndsWith',
  'Contains',
  'GreaterThan',
  'GreaterThanOrEqual',
  'LessThan',
  'LessThanOrEqual',
  'Before',
  'After',
  'OnDate',
  'OnTime',
  'ParentOf',
  'ChildOf',
  'DescendsFrom',
  'AscendsFrom',
  'Within',
  'Intersects',
  'Exists'
]);
export type PredicateOperator = z.infer<typeof PredicateOperator>;

/**
 * Internal normalized predicate payload used after semantic validation.
 *
 * Public expression predicates are property-driven and scalar-valued. Services resolve property metadata, validate the
 * scalar value, and convert it to this internal shape so repositories can route persistence and SQL compilation to the
 * existing typed predicate/search tables.
 */
export type InternalTypedPredicate =
  | { type: 'string'; operator: PredicateOperator; value?: string }
  | { type: 'number'; operator: PredicateOperator; value?: number }
  | { type: 'boolean'; operator: PredicateOperator; value?: boolean }
  | { type: 'timestamp'; operator: PredicateOperator; value?: string }
  | { type: 'taxon'; operator: PredicateOperator; value?: number }
  | { type: 'geometry'; operator: PredicateOperator; value?: unknown }
  | { type: 'code'; operator: PredicateOperator; value?: number };
