import type {
  NormalizedExpressionTree,
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import type { LogicalOperator } from '../models/logical-operator';

/**
 * Simplifies a normalized expression before SQL generation.
 *
 * The optimizer preserves the authored boolean structure except for safe canonicalization. For example, duplicate
 * bounds on one property are removed and the remaining bounds are grouped so SQL evaluates them against one value:
 *
 * @example
 * Input:  Count > 7 AND Count < 9 AND Count > 7
 * Output: AND(Count > 7, Count < 9)
 *
 * @example
 * Input:  Count = 77 OR Count = 100
 * Output: OR(Count = 100, Count = 77)
 *
 * The second output is ordered by its canonical structural key; its SQL representation may use `IN (100, 77)`.
 * Unsupported combinations retain separate predicate clauses and therefore keep their existing evaluation pathway.
 *
 * @param {NormalizedExpressionTree} expression - Normalized, semantically resolved expression tree.
 * @return {NormalizedExpressionTree} Deduplicated tree with compatible predicates nested by property.
 */
export const optimizeExpression = (expression: NormalizedExpressionTree): NormalizedExpressionTree => {
  const clauses = removeDuplicateClauses(
    expression.clauses.map((clause) => (clause.type === 'expression' ? optimizeExpression(clause) : clause))
  );
  const expressions = clauses.filter((clause): clause is NormalizedExpressionTree => clause.type === 'expression');
  const predicates = [...collectPredicatesByProperty(clauses).values()].flatMap((propertyPredicates) =>
    expression.operator === 'AND' ? optimizeAndPredicates(propertyPredicates) : optimizeOrPredicates(propertyPredicates)
  );
  const optimizedClauses = [...predicates, ...expressions].sort(compareClauses);

  if (
    optimizedClauses.length === 1 &&
    optimizedClauses[0].type === 'expression' &&
    optimizedClauses[0].operator === expression.operator
  ) {
    return { ...expression, clauses: optimizedClauses[0].clauses };
  }

  return { ...expression, clauses: optimizedClauses };
};

/**
 * Collects direct sibling predicates by their resolved evidence domain.
 *
 * @example
 * Input:  [Count > 7, Count < 9, Height = 3, nestedExpression]
 * Output: Map {
 *   'property:<count id>' => [Count > 7, Count < 9],
 *   'property:<height id>' => [Height = 3]
 * }
 *
 * Nested expressions are omitted because predicates may only be coalesced with direct siblings under the same logical
 * operator. Moving a predicate across an expression boundary could change its meaning.
 *
 * @param {NormalizedExpressionTreeClause[]} clauses - Direct clauses in one expression node.
 * @return {Map<string, NormalizedExpressionTreePredicate[]>} Predicates keyed by resolved property identity.
 */
const collectPredicatesByProperty = (
  clauses: NormalizedExpressionTreeClause[]
): Map<string, NormalizedExpressionTreePredicate[]> => {
  const properties = new Map<string, NormalizedExpressionTreePredicate[]>();

  clauses.forEach((clause) => {
    if (clause.type !== 'predicate') {
      return;
    }

    const identity = getPredicatePropertyIdentity(clause);
    const predicates = properties.get(identity) ?? [];
    predicates.push(clause);
    properties.set(identity, predicates);
  });

  return properties;
};

/**
 * Simplifies compatible predicates joined by AND.
 *
 * @example
 * Input:  [Exists(Count), Count > 7, Count < 9]
 * Output: [AND(Count > 7, Count < 9)]
 *
 * @example
 * Input:  [Count = 77, Count = 100]
 * Output: [AND(Count = 100, Count = 77)]
 *
 * Numeric comparisons share one property-row scan. Multiple equalities use anchor-level aggregation so distinct
 * values on separate visible evidence rows may jointly satisfy the AND expression. Other operators remain separate.
 *
 * @param {NormalizedExpressionTreePredicate[]} predicates - Same-property predicates.
 * @return {NormalizedExpressionTreeClause[]} Optimized AND clauses.
 */
const optimizeAndPredicates = (predicates: NormalizedExpressionTreePredicate[]): NormalizedExpressionTreeClause[] => {
  const candidates = predicates.filter((predicate) => predicate.operator !== 'Exists');
  if (candidates.length === 0) {
    return predicates;
  }

  const equalities = candidates.filter((predicate) => predicate.operator === 'Equals');
  const comparisons = candidates.filter(isNumericComparison);
  const otherPredicates = candidates.filter(
    (predicate) => predicate.operator !== 'Equals' && !isNumericComparison(predicate)
  );

  return [
    ...otherPredicates,
    ...(equalities.length > 1 ? [createExpression('AND', equalities)] : equalities),
    ...(comparisons.length > 1 ? [createExpression('AND', comparisons)] : comparisons)
  ];
};

/**
 * Simplifies compatible predicates joined by OR.
 *
 * @example
 * Input:  [Count = 77, Count = 100]
 * Output: [OR(Count = 100, Count = 77)]
 *
 * @example
 * Input:  [Exists(Count), Count = 77]
 * Output: [Exists(Count)]
 *
 * Equality alternatives become one value-set lookup. `Exists` subsumes compatible positive predicates because every
 * matching value necessarily proves that the property exists. Unsupported operators remain independent.
 *
 * @param {NormalizedExpressionTreePredicate[]} predicates - Same-property predicates.
 * @return {NormalizedExpressionTreeClause[]} Optimized OR clauses.
 */
const optimizeOrPredicates = (predicates: NormalizedExpressionTreePredicate[]): NormalizedExpressionTreeClause[] => {
  const exists = predicates.find((predicate) => predicate.operator === 'Exists');
  if (exists) {
    return [exists];
  }

  const equalities = predicates.filter((predicate) => predicate.operator === 'Equals');

  return equalities.length > 1
    ? [...predicates.filter((predicate) => predicate.operator !== 'Equals'), createExpression('OR', equalities)]
    : predicates;
};

/**
 * Creates a logical expression from compatible predicates.
 *
 * @param {LogicalOperator} operator - Operator joining the predicates.
 * @param {NormalizedExpressionTreePredicate[]} predicates - Predicates to nest.
 * @return {NormalizedExpressionTree} Nested predicate expression.
 */
const createExpression = (
  operator: LogicalOperator,
  predicates: NormalizedExpressionTreePredicate[]
): NormalizedExpressionTree => ({
  type: 'expression',
  operator,
  clauses: predicates.toSorted(compareClauses)
});

/**
 * Removes structurally identical clauses from one expression level.
 *
 * @example
 * Input:  [Count > 7, Height = 3, Count > 7]
 * Output: [Count > 7, Height = 3]
 *
 * Only exact structural duplicates are removed. Predicates with different assignments, operators, values, or nested
 * boolean structure produce different keys and remain in the result.
 *
 * @param {NormalizedExpressionTreeClause[]} clauses - Sibling clauses to deduplicate.
 * @return {NormalizedExpressionTreeClause[]} Clauses with only the first occurrence of each structural key.
 */
const removeDuplicateClauses = (clauses: NormalizedExpressionTreeClause[]): NormalizedExpressionTreeClause[] => {
  const seen = new Set<string>();
  return clauses.filter((clause) => {
    const key = getClauseKey(clause);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Determines whether a predicate applies a numeric comparison operator to a number property.
 *
 * @param {NormalizedExpressionTreePredicate} predicate - Predicate to inspect.
 * @return {boolean} True when the predicate is a numeric comparison; otherwise false.
 */
const isNumericComparison = (predicate: NormalizedExpressionTreePredicate): boolean => {
  if (predicate.internal_predicate.type !== 'number') {
    return false;
  }

  switch (predicate.operator) {
    case 'GreaterThan':
    case 'GreaterThanOrEqual':
    case 'LessThan':
    case 'LessThanOrEqual':
      return true;
    default:
      return false;
  }
};

/**
 * Builds the stable identity for a predicate's resolved property evidence domain.
 *
 * @example
 * A predicate with `feature_type_property_id: 108` returns `assignment:108`.
 * A predicate with `feature_type_property_id: null` and `feature_property_id: 14` returns `property:14`.
 *
 * A concrete assignment takes precedence because it identifies one exact evidence domain. A null assignment means the
 * predicate intentionally applies to every active assignment of the shared semantic property.
 *
 * @param {NormalizedExpressionTreePredicate} predicate - Predicate containing the resolved property identifiers.
 * @return {string} Assignment-specific key, or a shared-property key when no assignment is specified.
 */
const getPredicatePropertyIdentity = (predicate: NormalizedExpressionTreePredicate): string =>
  predicate.feature_type_property_id === null
    ? `property:${predicate.feature_property_id}`
    : `assignment:${predicate.feature_type_property_id}`;

/**
 * Determines whether an expression represents predicates that the evaluator can coalesce.
 *
 * @example
 * `AND(Count > 7, Count < 9)` returns `true` because both bounds can constrain one numeric property scan.
 * `OR(Count = 77, Count = 100)` returns `true` because both alternatives can use one `IN` filter.
 * `OR(Count > 7, Count < 9)` returns `false` because OR comparisons retain the independent evaluation pathway.
 * `AND(Count > 7, Height < 9)` returns `false` because the predicates target different properties.
 *
 * @param {NormalizedExpressionTree} expression - Expression to inspect.
 * @return {boolean} True for same-property equalities or same-property numeric comparisons joined by AND.
 */
export const hasCompatiblePredicates = (expression: NormalizedExpressionTree): boolean => {
  const predicates = expression.clauses.filter((clause) => clause.type === 'predicate');

  if (predicates.length < 2 || predicates.length !== expression.clauses.length) {
    return false;
  }

  const property = getPredicatePropertyIdentity(predicates[0]);

  if (!predicates.every((predicate) => getPredicatePropertyIdentity(predicate) === property)) {
    return false;
  }

  return (
    predicates.every((predicate) => predicate.operator === 'Equals') ||
    (expression.operator === 'AND' && predicates.every(isNumericComparison))
  );
};

/**
 * Builds a deterministic structural key for an expression clause.
 *
 * @example
 * const predicate = {
 *   type: 'predicate',
 *   feature_property_id: 14,
 *   feature_type_property_id: 108,
 *   feature_property_type_id: 5,
 *   feature_property_type_name: 'number',
 *   operator: 'GreaterThan',
 *   value: 10,
 *   internal_predicate: { type: 'number', operator: 'GreaterThan', value: 10 }
 * };
 *
 * getClauseKey(predicate);
 * // => '["0","assignment:108",{"type":"number","operator":"GreaterThan","value":10}]'
 *
 * const expression = {
 *   type: 'expression',
 *   operator: 'AND',
 *   clauses: [predicate]
 * };
 *
 * JSON.parse(getClauseKey(expression));
 * // => ['1', 'AND', ['["0","assignment:108",{"type":"number","operator":"GreaterThan","value":10}]']]
 *
 * @param {NormalizedExpressionTreeClause} clause - Predicate or nested expression to serialize.
 * @return {string} Stable key used to order clauses and identify duplicates.
 */
const getClauseKey = (clause: NormalizedExpressionTreeClause): string =>
  JSON.stringify(
    clause.type === 'predicate'
      ? ['0', getPredicatePropertyIdentity(clause), clause.internal_predicate]
      : ['1', clause.operator, clause.clauses.map(getClauseKey)]
  );

/**
 * Compares two clauses by their deterministic structural keys.
 *
 * @example
 * compareClauses(predicateForProperty14, predicateForProperty15);
 * // => -1 because the left structural key sorts before the right structural key
 *
 * compareClauses(predicateForProperty14, predicateForProperty14);
 * // => 0 because the clauses are structurally identical
 *
 * compareClauses(predicateForProperty15, predicateForProperty14);
 * // => 1 because the left structural key sorts after the right structural key
 *
 * @param {NormalizedExpressionTreeClause} left - Clause on the left side of the comparison.
 * @param {NormalizedExpressionTreeClause} right - Clause on the right side of the comparison.
 * @return {number} Negative, zero, or positive value suitable for array sorting.
 */
const compareClauses = (left: NormalizedExpressionTreeClause, right: NormalizedExpressionTreeClause): number => {
  const leftKey = getClauseKey(left);
  const rightKey = getClauseKey(right);

  if (leftKey < rightKey) {
    return -1;
  }

  if (leftKey > rightKey) {
    return 1;
  }

  return 0;
};
