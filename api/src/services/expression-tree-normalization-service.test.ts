import { expect } from 'chai';
import { beforeEach, describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiValidationError } from '../errors/api-error';
import { PredicateOperator } from '../models/expression-predicate';
import { ExpressionPredicatePropertyMetadata } from '../models/feature-type-property';
import { TaxonRecord } from '../models/taxon';
import { FeatureTypePropertyRepository } from '../repositories/feature-type-property-repository';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { TaxonomyService } from './taxonomy-service';

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

const taxonRecord = (taxon_id: number): TaxonRecord => ({
  taxon_id,
  itis_tsn: 180693,
  parent_itis_tsn: null,
  parent_taxon_id: null,
  bc_taxon_code: null,
  itis_scientific_name: 'Cervidae',
  rank: 'Family',
  common_name: null,
  itis_data: {},
  itis_update_date: '2020-01-01'
});

describe('ExpressionTreeNormalizationService', () => {
  let currentMetadata: ExpressionPredicatePropertyMetadata;
  let getPropertyMetadata: sinon.SinonStub;

  beforeEach(() => {
    currentMetadata = metadata('string');
    getPropertyMetadata = sinon
      .stub(FeatureTypePropertyRepository.prototype, 'getExpressionPredicatePropertyMetadata')
      .callsFake(async () => currentMetadata);
  });

  afterEach(() => {
    sinon.restore();
  });

  const normalizeOne = async (
    propertyType: ExpressionPredicatePropertyMetadata['feature_property_type_name'],
    operator: PredicateOperator,
    value?: unknown
  ) => {
    currentMetadata = metadata(propertyType);

    const expressionTreeNormalizationService = new ExpressionTreeNormalizationService(getMockDBConnection());
    const tree = {
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
    } as const;

    return expressionTreeNormalizationService.normalize(tree);
  };

  it('flattens and orders associative expressions without removing duplicates', async () => {
    const expressionTreeNormalizationService = new ExpressionTreeNormalizationService(getMockDBConnection());
    const result = await expressionTreeNormalizationService.normalize({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 15,
          feature_type_property_id: null,
          operator: 'Equals',
          value: 'second'
        },
        {
          type: 'expression',
          operator: 'AND',
          clauses: [
            {
              type: 'predicate',
              feature_property_id: 14,
              feature_type_property_id: null,
              operator: 'Equals',
              value: 'first'
            },
            {
              type: 'predicate',
              feature_property_id: 14,
              feature_type_property_id: null,
              operator: 'Equals',
              value: 'first'
            }
          ]
        }
      ]
    });

    expect(result.clauses.map((clause) => clause.type === 'predicate' && clause.feature_property_id)).to.eql([
      14, 14, 15
    ]);
  });

  it('preserves expressions separated by a different logical operator', async () => {
    const expressionTreeNormalizationService = new ExpressionTreeNormalizationService(getMockDBConnection());
    const result = await expressionTreeNormalizationService.normalize({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'expression',
          operator: 'OR',
          clauses: [
            {
              type: 'predicate',
              feature_property_id: 14,
              feature_type_property_id: null,
              operator: 'Equals',
              value: 'first'
            }
          ]
        }
      ]
    });

    expect(result.clauses[0]).to.include({ type: 'expression', operator: 'OR' });
  });

  it('resolves repeated property metadata once per normalization call', async () => {
    const expressionTreeNormalizationService = new ExpressionTreeNormalizationService(getMockDBConnection());
    await expressionTreeNormalizationService.normalize({
      type: 'expression',
      operator: 'AND',
      clauses: [
        {
          type: 'predicate',
          feature_property_id: 10,
          feature_type_property_id: 20,
          operator: 'Equals',
          value: 'first'
        },
        {
          type: 'predicate',
          feature_property_id: 10,
          feature_type_property_id: 20,
          operator: 'Equals',
          value: 'second'
        }
      ]
    });

    expect(getPropertyMetadata).to.have.been.calledOnceWithExactly(10, 20);
  });

  it('normalizes a taxon DescendsFrom predicate', async () => {
    sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([taxonRecord(456)]);

    const result = await normalizeOne('taxon', 'DescendsFrom', 180703);
    const predicate = result.clauses[0];

    expect(predicate).to.include({
      type: 'predicate',
      feature_property_type_id: 30,
      feature_property_type_name: 'taxon'
    });
    expect(predicate.type === 'predicate' && predicate.internal_predicate).to.eql({
      type: 'taxon',
      operator: 'DescendsFrom',
      value: 456
    });
  });

  it('resolves a numeric taxon TSN to an internal taxon_id', async () => {
    const taxonStub = sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([taxonRecord(456)]);

    const result = await normalizeOne('taxon', 'Equals', 180703);
    const predicate = result.clauses[0];

    // The client value is an ITIS TSN; findTaxon resolves it to the internal taxon_id.
    expect(taxonStub).to.have.been.calledOnceWith({ itis_tsn: 180703 });
    expect(predicate.type === 'predicate' && predicate.internal_predicate).to.eql({
      type: 'taxon',
      operator: 'Equals',
      value: 456
    });
  });

  it('resolves a taxon scientific-name string to a taxon_id', async () => {
    const taxonStub = sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([taxonRecord(7)]);

    const result = await normalizeOne('taxon', 'DescendsFrom', 'Cervidae');
    const predicate = result.clauses[0];

    expect(taxonStub).to.have.been.calledOnceWith({ itis_scientific_name: 'Cervidae' });
    expect(predicate.type === 'predicate' && predicate.internal_predicate).to.eql({
      type: 'taxon',
      operator: 'DescendsFrom',
      value: 7
    });
  });

  it('resolves a numeric-string taxon TSN to an internal taxon_id', async () => {
    const taxonStub = sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([taxonRecord(456)]);

    const result = await normalizeOne('taxon', 'Equals', '180703');
    const predicate = result.clauses[0];

    expect(taxonStub).to.have.been.calledOnceWith({ itis_tsn: 180703 });
    expect(predicate.type === 'predicate' && predicate.internal_predicate).to.eql({
      type: 'taxon',
      operator: 'Equals',
      value: 456
    });
  });

  it('rejects an out-of-range numeric-string taxon TSN', async () => {
    sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([]);

    try {
      await normalizeOne('taxon', 'Equals', '2147483648');
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(ApiValidationError);
      expect((error as ApiValidationError).message).to.equal('Predicate value must be a valid ITIS TSN');
    }
  });

  it('rejects an ambiguous taxon value', async () => {
    sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([taxonRecord(7), taxonRecord(8)]);

    try {
      await normalizeOne('taxon', 'DescendsFrom', 'Cervidae');
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(ApiValidationError);
      expect((error as ApiValidationError).message).to.equal('Taxon value matched multiple taxa');
    }
  });

  it('resolves a taxon value for every taxon operator', async () => {
    sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([taxonRecord(7)]);

    for (const operator of ['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom'] as const) {
      const result = await normalizeOne('taxon', operator, 180703);
      const predicate = result.clauses[0];

      expect(predicate.type === 'predicate' && predicate.internal_predicate).to.eql({
        type: 'taxon',
        operator,
        value: 7
      });
    }
  });

  it('rejects a TSN that does not exist locally without fetching it from ITIS', async () => {
    const taxonStub = sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([]);
    const ensureStub = sinon.stub(TaxonomyService.prototype, 'ensureTaxonHierarchyByTsnIds').resolves();

    try {
      await normalizeOne('taxon', 'Equals', 999999);
      expect.fail();
    } catch (error) {
      expect(taxonStub).to.have.been.calledOnceWith({ itis_tsn: 999999 });
      expect(ensureStub).to.not.have.been.called;
      expect(error).to.be.instanceOf(ApiValidationError);
      expect((error as ApiValidationError).message).to.equal('Taxon not found');
    }
  });

  it('rejects a scientific-name taxon value that resolves to no local taxon', async () => {
    const taxonStub = sinon.stub(TaxonomyService.prototype, 'findTaxon').resolves([]);
    const ensureStub = sinon.stub(TaxonomyService.prototype, 'ensureTaxonHierarchyByTsnIds').resolves();

    try {
      await normalizeOne('taxon', 'Equals', 'Notarealtaxon');
      expect.fail();
    } catch (error) {
      expect(taxonStub).to.have.been.calledOnceWith({ itis_scientific_name: 'Notarealtaxon' });
      expect(ensureStub).to.not.have.been.called;
      expect(error).to.be.instanceOf(ApiValidationError);
      expect((error as ApiValidationError).message).to.equal('Taxon not found');
    }
  });

  it('rejects an operator that is invalid for the property type', async () => {
    try {
      await normalizeOne('taxon', 'After', 123);
      expect.fail();
    } catch (error) {
      expect(error).to.be.instanceOf(ApiValidationError);
    }
  });

  it('normalizes datetime date, time, and datetime scalar literals', async () => {
    const date = await normalizeOne('datetime', 'After', '2020-01-01');
    const time = await normalizeOne('datetime', 'After', '14:30:00-07:00');
    const dateTime = await normalizeOne('datetime', 'After', '2020-01-01T14:30:00-07:00');

    expect(date.clauses[0].type === 'predicate' && date.clauses[0].internal_predicate).to.deep.include({
      type: 'timestamp',
      operator: 'After',
      value: { date_value: '2020-01-01', time_value: null }
    });
    expect(time.clauses[0].type === 'predicate' && time.clauses[0].internal_predicate).to.deep.include({
      type: 'timestamp',
      operator: 'After',
      value: { date_value: null, time_value: '14:30:00-07:00' }
    });
    expect(dateTime.clauses[0].type === 'predicate' && dateTime.clauses[0].internal_predicate).to.deep.include({
      type: 'timestamp',
      operator: 'After',
      value: { date_value: '2020-01-01', time_value: '14:30:00-07:00' }
    });
  });

  it('enforces OnDate and OnTime literal kind rules', async () => {
    await normalizeOne('datetime', 'OnDate', '2020-01-01');
    await normalizeOne('datetime', 'OnTime', '14:30:00-07:00');

    for (const [operator, value] of [
      ['OnDate', '2020-01-01T14:30:00-07:00'],
      ['OnTime', '2020-01-01']
    ]) {
      try {
        await normalizeOne('datetime', operator, value);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiValidationError);
      }
    }
  });

  it('validates value shape and Exists semantics', async () => {
    await normalizeOne('string', 'Contains', 'wolf');
    await normalizeOne('boolean', 'Equals', true);
    await normalizeOne('code', 'Equals', 42);
    await normalizeOne('spatial', 'Within', { type: 'Point', coordinates: [0, 0] });
    await normalizeOne('number', 'Exists');

    for (const [type, operator, value] of [
      ['string', 'Contains', 42],
      ['boolean', 'NotEquals', true],
      ['datetime', 'Before', undefined],
      ['number', 'Exists', 1]
    ] as const) {
      try {
        await normalizeOne(type, operator, value);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiValidationError);
      }
    }
  });

  it('preserves nullable feature_type_property_id and resolves property metadata', async () => {
    const expressionTreeNormalizationService = new ExpressionTreeNormalizationService(getMockDBConnection());

    const result = await expressionTreeNormalizationService.normalize({
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
