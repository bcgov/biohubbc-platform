import { expect } from 'chai';
import type { PredicateOperator } from '../models/expression-predicate';
import type { NormalizedExpressionTree, NormalizedExpressionTreePredicate } from '../models/expression-tree-internal';
import { hasCompatiblePredicates, optimizeExpression } from './expression-optimization';

/**
 * Builds a normalized numeric predicate for optimizer tests.
 *
 * @param {number} featurePropertyId - Semantic property identifier.
 * @param {number | null} featureTypePropertyId - Concrete assignment identifier, or null for all assignments.
 * @param {PredicateOperator} operator - Numeric predicate operator.
 * @param {number} [value] - Optional numeric predicate value.
 * @return {NormalizedExpressionTreePredicate} Normalized numeric predicate.
 */
const numberPredicate = (
  featurePropertyId: number,
  featureTypePropertyId: number | null,
  operator: PredicateOperator,
  value?: number
): NormalizedExpressionTreePredicate => ({
  type: 'predicate',
  feature_property_id: featurePropertyId,
  feature_type_property_id: featureTypePropertyId,
  feature_property_type_id: 5,
  feature_property_type_name: 'number',
  operator,
  value,
  internal_predicate: { type: 'number', operator, value }
});

describe('optimizeExpression', () => {
  it('combines same-property numeric bounds in one predicate expression', () => {
    const lower = numberPredicate(14, null, 'GreaterThan', 10);
    const upper = numberPredicate(14, null, 'LessThan', 20);
    const other = numberPredicate(15, null, 'Equals', 3);
    const expression: NormalizedExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [lower, upper, other]
    };

    expect(optimizeExpression(expression).clauses).to.deep.equal([
      other,
      {
        type: 'expression',
        operator: 'AND',
        clauses: [lower, upper]
      }
    ]);
  });

  it('keeps every compatible bound for one property in a single expression', () => {
    const predicates = [
      numberPredicate(14, null, 'GreaterThan', 7),
      numberPredicate(14, null, 'LessThan', 9),
      numberPredicate(14, null, 'GreaterThan', 3),
      numberPredicate(14, null, 'LessThan', 5)
    ];

    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: predicates
    });

    expect(optimized).to.deep.include({ type: 'expression', operator: 'AND' });
    expect(optimized.clauses).to.have.length(4);
    expect(optimized.clauses.every((clause) => clause.type === 'predicate')).to.equal(true);
    expect(hasCompatiblePredicates(optimized)).to.equal(true);
  });

  it('coalesces inclusive and exclusive numeric bounds regardless of input order', () => {
    const predicates = [
      numberPredicate(14, 108, 'LessThanOrEqual', 20),
      numberPredicate(14, 108, 'GreaterThan', 10),
      numberPredicate(14, 108, 'LessThan', 19),
      numberPredicate(14, 108, 'GreaterThanOrEqual', 11)
    ];

    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: predicates
    });

    expect(hasCompatiblePredicates(optimized)).to.equal(true);
    expect(optimized.clauses).to.deep.equal([predicates[1], predicates[3], predicates[2], predicates[0]]);
  });

  it('coalesces AND equality predicates with anchor-level multi-value semantics', () => {
    const first = numberPredicate(14, null, 'Equals', 77);
    const second = numberPredicate(14, null, 'Equals', 100);
    const other = numberPredicate(15, null, 'Equals', 3);
    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: [first, other, second]
    });

    expect(optimized.clauses).to.deep.equal([other, { type: 'expression', operator: 'AND', clauses: [second, first] }]);
  });

  it('coalesces OR equality predicates with same-value semantics', () => {
    const first = numberPredicate(14, 108, 'Equals', 77);
    const second = numberPredicate(14, 108, 'Equals', 100);
    const other = numberPredicate(15, null, 'Equals', 3);
    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'OR',
      clauses: [second, other, first]
    });

    expect(optimized.clauses).to.deep.equal([other, { type: 'expression', operator: 'OR', clauses: [second, first] }]);
  });

  it('removes duplicate predicates and produces stable clause ordering', () => {
    const first = numberPredicate(14, null, 'GreaterThan', 10);
    const second = numberPredicate(15, null, 'Equals', 3);
    const left = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: [second, first, first]
    });
    const right = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: [first, second]
    });

    expect(left).to.deep.equal(right);
    expect(left.clauses).to.have.length(2);
  });

  it('removes expressions that become duplicates during recursive optimization', () => {
    const predicate = numberPredicate(14, null, 'Equals', 77);
    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'OR',
      clauses: [
        { type: 'expression', operator: 'AND', clauses: [predicate, predicate] },
        { type: 'expression', operator: 'AND', clauses: [predicate] }
      ]
    });

    expect(optimized.clauses).to.deep.equal([{ type: 'expression', operator: 'AND', clauses: [predicate] }]);
  });

  it('is idempotent', () => {
    const expression: NormalizedExpressionTree = {
      type: 'expression',
      operator: 'AND',
      clauses: [
        numberPredicate(14, null, 'GreaterThan', 10),
        numberPredicate(14, null, 'LessThan', 20),
        numberPredicate(15, null, 'Equals', 3)
      ]
    };
    const optimized = optimizeExpression(expression);

    expect(optimizeExpression(optimized)).to.deep.equal(optimized);
  });

  it('removes redundant Exists predicates under AND and subsumed positives under OR', () => {
    const exists = numberPredicate(14, null, 'Exists');
    const equals = numberPredicate(14, null, 'Equals', 77);
    const notEquals = numberPredicate(14, null, 'NotEquals', 100);

    expect(
      optimizeExpression({ type: 'expression', operator: 'AND', clauses: [exists, notEquals] }).clauses
    ).to.deep.equal([notEquals]);
    expect(
      optimizeExpression({ type: 'expression', operator: 'OR', clauses: [exists, equals, notEquals] }).clauses
    ).to.deep.equal([exists]);
  });

  it('does not combine concrete assignments or NotEquals predicates', () => {
    const first = numberPredicate(14, 108, 'Equals', 77);
    const second = numberPredicate(14, 109, 'Equals', 100);
    const notEquals = numberPredicate(14, 108, 'NotEquals', 50);
    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: [second, notEquals, first]
    });

    expect(optimized.clauses.every((clause) => clause.type === 'predicate')).to.equal(true);
  });

  it('does not combine predicates for different shared properties', () => {
    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: [numberPredicate(14, null, 'GreaterThan', 10), numberPredicate(15, null, 'LessThan', 20)]
    });

    expect(optimized.clauses.every((clause) => clause.type === 'predicate')).to.equal(true);
    expect(hasCompatiblePredicates(optimized)).to.equal(false);
  });

  it('preserves unsupported mixed and OR comparison combinations for independent evaluation', () => {
    const equality = numberPredicate(14, null, 'Equals', 15);
    const comparison = numberPredicate(14, null, 'GreaterThan', 10);
    const mixed = optimizeExpression({ type: 'expression', operator: 'AND', clauses: [comparison, equality] });
    const disjunction = optimizeExpression({
      type: 'expression',
      operator: 'OR',
      clauses: [numberPredicate(14, null, 'LessThan', 5), comparison]
    });

    expect(mixed.clauses).to.deep.equal([equality, comparison]);
    expect(disjunction.clauses.every((clause) => clause.type === 'predicate')).to.equal(true);
    expect(hasCompatiblePredicates(mixed)).to.equal(false);
    expect(hasCompatiblePredicates(disjunction)).to.equal(false);
  });

  it('retains Exists when it is the only predicate for a property', () => {
    const exists = numberPredicate(14, null, 'Exists');

    expect(optimizeExpression({ type: 'expression', operator: 'AND', clauses: [exists] }).clauses).to.deep.equal([
      exists
    ]);
  });

  it('does not flatten expressions with different operators', () => {
    const child: NormalizedExpressionTree = {
      type: 'expression',
      operator: 'OR',
      clauses: [numberPredicate(14, null, 'Equals', 77), numberPredicate(14, null, 'Equals', 100)]
    };
    const optimized = optimizeExpression({
      type: 'expression',
      operator: 'AND',
      clauses: [child, numberPredicate(15, null, 'Equals', 3)]
    });

    expect(optimized.clauses.some((clause) => clause.type === 'expression' && clause.operator === 'OR')).to.equal(true);
  });
});
