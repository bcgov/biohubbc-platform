import { expect } from 'chai';
import { describe } from 'mocha';
import { ExpressionTree } from './expression-tree';

describe('ExpressionTree', () => {
  it('accepts a valid nested flat expression tree', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 'Wolf'
        },
        {
          type: 'expression',
          operator: 'OR',
          clauses: [
            {
              type: 'predicate',
              feature_property_id: 2,
              feature_type_property_id: null,
              operator: 'GreaterThan',
              value: 10
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
      feature_property_id: 1,
      feature_type_property_id: null,
      operator: 'Equals',
      value: true
    });

    expect(result.success).to.be.false;
  });

  it('rejects old nested predicate payloads', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          predicate: {
            type: 'boolean',
            operator: 'Equals',
            value: true
          }
        }
      ]
    });

    expect(result.success).to.be.false;
  });

  it('rejects invalid operator strings', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 1,
          feature_type_property_id: null,
          operator: 'FakeOperator',
          value: true
        }
      ]
    });

    expect(result.success).to.be.false;
  });

  it('accepts scalar datetime values structurally', () => {
    const result = ExpressionTree.safeParse({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 5,
          feature_type_property_id: null,
          operator: 'OnDate',
          value: '2026-04-20'
        }
      ]
    });

    expect(result.success).to.be.true;
  });
});
