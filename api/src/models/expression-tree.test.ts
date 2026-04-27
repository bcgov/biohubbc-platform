import { expect } from 'chai';
import { describe } from 'mocha';
import { ExpressionTree } from './expression-tree';

describe('ExpressionTree', () => {
  it('accepts a valid nested expression tree', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_type_property_id: 1,
          predicate: {
            type: 'string',
            operator: 'Equals',
            value: 'Wolf'
          }
        },
        {
          type: 'expression',
          operator: 'OR',
          clauses: [
            {
              type: 'predicate',
              feature_type_property_id: 2,
              predicate: {
                type: 'number',
                operator: 'GreaterThan',
                value: 10
              }
            }
          ]
        }
      ]
    });

    expect(result.success).to.be.true;
  });

  it('rejects empty expression clauses', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: []
    });

    expect(result.success).to.be.false;
  });

  it('rejects root predicates for ExpressionTree', () => {
    const result = ExpressionTree.safeParse({
      type: 'predicate',
      feature_type_property_id: 1,
      predicate: {
        type: 'boolean',
        operator: 'Equals',
        value: true
      }
    });

    expect(result.success).to.be.false;
  });

  it('rejects Exists predicates with values', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_type_property_id: 1,
          predicate: {
            type: 'boolean',
            operator: 'Exists',
            value: true
          }
        }
      ]
    });

    expect(result.success).to.be.false;
  });

  it('rejects non-Exists code predicate without required scalar value', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_type_property_id: 4,
          predicate: {
            type: 'code',
            operator: 'Equals'
          }
        }
      ]
    });

    expect(result.success).to.be.false;
  });

  it('accepts timestamp OnDate with only date_value', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_type_property_id: 5,
          predicate: {
            type: 'timestamp',
            operator: 'OnDate',
            value: {
              date_value: '2026-04-20'
            }
          }
        }
      ]
    });

    expect(result.success).to.be.true;
  });

  it('rejects timestamp OnDate when time_value is present', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_type_property_id: 5,
          predicate: {
            type: 'timestamp',
            operator: 'OnDate',
            value: {
              date_value: '2026-04-20',
              time_value: '13:00:00+00'
            }
          }
        }
      ]
    });

    expect(result.success).to.be.false;
  });

  it('accepts scalar taxon and code predicate values', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_type_property_id: 11,
          predicate: {
            type: 'taxon',
            operator: 'DescendsFrom',
            value: 100
          }
        },
        {
          type: 'predicate',
          feature_type_property_id: 12,
          predicate: {
            type: 'code',
            operator: 'Equals',
            value: 42
          }
        }
      ]
    });

    expect(result.success).to.be.true;
  });
});
