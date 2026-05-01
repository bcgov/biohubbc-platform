import { expect } from 'chai';
import { beforeEach, describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { PredicateOperator } from '../models/expression-predicate';
import { ExpressionPredicatePropertyMetadata } from '../models/feature-type-property';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';

const metadata = (
  feature_property_type_name: ExpressionPredicatePropertyMetadata['feature_property_type_name'],
  overrides?: Partial<ExpressionPredicatePropertyMetadata>
): ExpressionPredicatePropertyMetadata => ({
  feature_property_id: 10,
  feature_type_property_id: 20,
  feature_property_type_id: 30,
  feature_property_type_name,
  display_name: 'Species',
  ...overrides
});

describe('ExpressionPredicateSemanticValidator', () => {
  let currentMetadata: ExpressionPredicatePropertyMetadata;

  beforeEach(() => {
    currentMetadata = metadata('string');
    sinon
      .stub(FeatureTypePropertyRepository.prototype, 'getExpressionPredicatePropertyMetadata')
      .callsFake(async () => currentMetadata);
  });

  afterEach(() => {
    sinon.restore();
  });

  const validateOne = async (
    propertyType: ExpressionPredicatePropertyMetadata['feature_property_type_name'],
    operator: PredicateOperator,
    value?: unknown
  ) => {
    currentMetadata = metadata(propertyType);

    const validator = new ExpressionPredicateSemanticValidator(getMockDBConnection());
    return validator.validateExpressionTree({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 10,
          feature_type_property_id: 20,
          operator,
          ...(value !== undefined ? { value } : {})
        }
      ]
    });
  };

  it('normalizes a taxon DescendsFrom predicate', async () => {
    const result = await validateOne('taxon', 'DescendsFrom', 123);
    const predicate = result.clauses[0];

    expect(predicate).to.include({
      type: 'predicate',
      feature_property_type_id: 30,
      feature_property_type_name: 'taxon'
    });
    expect(predicate.type === 'predicate' && predicate.internal_predicate).to.eql({
      type: 'taxon',
      operator: 'DescendsFrom',
      value: 123
    });
  });

  it('rejects an operator that is invalid for the property type', async () => {
    try {
      await validateOne('taxon', 'After', 123);
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(ApiGeneralError);
    }
  });

  it('normalizes datetime date, time, and datetime scalar literals', async () => {
    const date = await validateOne('datetime', 'After', '2020-01-01');
    const time = await validateOne('datetime', 'After', '14:30:00-07:00');
    const dateTime = await validateOne('datetime', 'After', '2020-01-01T14:30:00-07:00');

    expect(date.clauses[0].type === 'predicate' && date.clauses[0].internal_predicate).to.deep.include({
      type: 'timestamp',
      operator: 'After',
      value: '2020-01-01'
    });
    expect(time.clauses[0].type === 'predicate' && time.clauses[0].internal_predicate).to.deep.include({
      type: 'timestamp',
      operator: 'After',
      value: '14:30:00-07:00'
    });
    expect(dateTime.clauses[0].type === 'predicate' && dateTime.clauses[0].internal_predicate).to.deep.include({
      type: 'timestamp',
      operator: 'After',
      value: '2020-01-01T14:30:00-07:00'
    });
  });

  it('enforces OnDate and OnTime literal kind rules', async () => {
    await validateOne('datetime', 'OnDate', '2020-01-01');
    await validateOne('datetime', 'OnTime', '14:30:00-07:00');

    for (const [operator, value] of [
      ['OnDate', '2020-01-01T14:30:00-07:00'],
      ['OnTime', '2020-01-01']
    ]) {
      try {
        await validateOne('datetime', operator, value);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
      }
    }
  });

  it('validates value shape and Exists semantics', async () => {
    await validateOne('string', 'Contains', 'wolf');
    await validateOne('boolean', 'Equals', true);
    await validateOne('code', 'Equals', 42);
    await validateOne('spatial', 'Within', { type: 'Point', coordinates: [0, 0] });
    await validateOne('number', 'Exists');

    for (const [type, operator, value] of [
      ['string', 'Contains', 42],
      ['boolean', 'NotEquals', true],
      ['datetime', 'Before', undefined],
      ['number', 'Exists', 1]
    ] as const) {
      try {
        await validateOne(type, operator, value);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiGeneralError);
      }
    }
  });

  it('preserves nullable feature_type_property_id and resolves property metadata', async () => {
    const validator = new ExpressionPredicateSemanticValidator(getMockDBConnection());

    const result = await validator.validateExpressionTree({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 10,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 'wolf'
        }
      ]
    });

    expect(result.clauses[0]).to.include({
      type: 'predicate',
      feature_type_property_id: null,
      feature_property_type_id: 30,
      feature_property_type_name: 'string'
    });
  });
});
