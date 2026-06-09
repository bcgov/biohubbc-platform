import type { PredicateOperator } from '../models/expression-predicate';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';

/**
 * Maximum hop count for the recursive content-edge (`data.content`) walk in expression search.
 *
 * The closure precomputes parent-ancestry and property-reference reach, so the only run-time
 * recursion left is the bounded walk over `submission_feature_feature` content edges. This caps
 * that walk.
 */
export const MAX_SEARCH_GRAPH_DEPTH = 6;

/**
 * Shared operator registry keyed by resolved feature property type.
 *
 * Used after structural parsing to validate predicate semantics and expose expression-builder metadata.
 */
export const OperatorsByPropertyType = {
  [FEATURE_PROPERTY_TYPE.STRING]: [
    'Equals',
    'NotEquals',
    'Like',
    'ILike',
    'StartsWith',
    'EndsWith',
    'Contains',
    'Exists'
  ],
  [FEATURE_PROPERTY_TYPE.NUMBER]: [
    'Equals',
    'NotEquals',
    'GreaterThan',
    'GreaterThanOrEqual',
    'LessThan',
    'LessThanOrEqual',
    'Exists'
  ],
  [FEATURE_PROPERTY_TYPE.BOOLEAN]: ['Equals', 'Exists'],
  [FEATURE_PROPERTY_TYPE.DATETIME]: ['Before', 'After', 'OnDate', 'OnTime', 'Exists'],
  [FEATURE_PROPERTY_TYPE.TAXON]: ['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom', 'Exists'],
  [FEATURE_PROPERTY_TYPE.SPATIAL]: ['Within', 'Intersects', 'Contains', 'Exists'],
  [FEATURE_PROPERTY_TYPE.CODE]: ['Equals', 'NotEquals', 'Exists']
} as const satisfies Record<
  Exclude<FEATURE_PROPERTY_TYPE, FEATURE_PROPERTY_TYPE.ARTIFACT_KEY>,
  readonly PredicateOperator[]
>;

export type PredicatePropertyTypeName = keyof typeof OperatorsByPropertyType;

/**
 * Property types that can be used by expression predicates in this branch.
 */
export const SupportedExpressionPropertyTypes = new Set<string>(Object.keys(OperatorsByPropertyType));
