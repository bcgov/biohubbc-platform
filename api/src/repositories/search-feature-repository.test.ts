import { expect } from 'chai';
import Sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { getKnex } from '../database/db';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { dependencies as expressionEvaluation } from './expression-evaluation';
import { SearchFeatureRepository } from './search-feature-repository';

const normalizedPredicate = (
  feature_property_id: number,
  feature_type_property_id: number | null,
  internal_predicate: any
) => ({
  type: 'predicate' as const,
  feature_property_id,
  feature_type_property_id,
  operator: internal_predicate.operator,
  ...(internal_predicate.value !== undefined ? { value: internal_predicate.value } : {}),
  feature_property_type_id: internal_predicate.type === 'number' ? 2 : 1,
  feature_property_type_name: internal_predicate.type === 'geometry' ? 'spatial' : internal_predicate.type,
  internal_predicate
});

describe('SearchFeatureRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('searchFeaturesByExpressionTree (wrapper relay)', () => {
    it('should call buildExpressionTreeFeatureIdsSubquery with relayed args and thread the subquery via whereIn', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery').returns(
        getKnex()('any_table').select('submission_feature_id')
      );

      const expressionTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Equals',
              value: 'moose'
            })
          }
        ]
      };

      await repository.searchFeaturesByExpressionTree('survey', expressionTree, undefined, 42);

      expect(subqueryStub.calledOnce).to.equal(true);
      expect(subqueryStub.getCall(0).args).to.deep.equal(['survey', expressionTree, 42]);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('"sf"."submission_feature_id" in');
      expect(sql).to.include('any_table');
    });

    it('should default systemUserId to null when omitted', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery').returns(
        getKnex()('any_table').select('submission_feature_id')
      );

      const expressionTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Equals',
              value: 'moose'
            })
          }
        ]
      };

      await repository.searchFeaturesByExpressionTree('survey', expressionTree);

      expect(subqueryStub.getCall(0).args[2]).to.equal(null);
    });

    it('should NOT call buildExpressionTreeFeatureIdsSubquery when expressionTree is undefined and fall back to anchor-only path', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery');

      await repository.searchFeaturesByExpressionTree('telemetry', undefined, { page: 1, limit: 25 }, null);

      expect(subqueryStub.notCalled).to.equal(true);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('"ft"."name" = \'telemetry\'');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include("COALESCE(typed_properties.properties, '{}'::jsonb) as properties");
      expect(sql).to.not.include('sf.data');
      expect(sql).to.not.include('"sf"."submission_feature_id" in');
      expect(sql).to.include('order by "submission_feature_id" asc');
      expect(sql).to.include('limit 25');
    });

    it('should hydrate expression-search fields from typed property tables instead of submission_feature.data', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByExpressionTree('survey', undefined, undefined, null);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.not.include('sf.data');
      expect(sql).to.include('AS typed_properties ON true');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('submission_feature_property_boolean');
      expect(sql).to.include('submission_feature_property_timestamp');
      expect(sql).to.include('submission_feature_property_geometry');
      expect(sql).to.include('submission_feature_property_code');
      expect(sql).to.include('submission_feature_property_taxon');
      expect(sql).to.include('submission_feature_property_feature');
      expect(sql).to.include('contributor_codeset_code');
      expect(sql).to.include('public.ST_AsGeoJSON');
      expect(sql).to.include('referenced_sf.urn');
    });
  });

  describe('searchFeaturesByExpressionTreeCount (wrapper relay)', () => {
    it('should layer count(*) over the subquery construction', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ count: 7 }] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      const subqueryStub = Sinon.stub(expressionEvaluation, 'buildExpressionTreeFeatureIdsSubquery').returns(
        getKnex()('any_table').select('submission_feature_id')
      );

      const expressionTree: NormalizedExpressionTreeExpression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            ...normalizedPredicate(46, null, {
              type: 'string',
              operator: 'Equals',
              value: 'moose'
            })
          }
        ]
      };

      const count = await repository.searchFeaturesByExpressionTreeCount('survey', expressionTree, 42);

      expect(count).to.equal(7);
      expect(subqueryStub.calledOnce).to.equal(true);
      expect(subqueryStub.getCall(0).args).to.deep.equal(['survey', expressionTree, 42]);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('count(*)::integer as count');
      expect(sql).to.include('"sf"."submission_feature_id" in');
      expect(sql).to.not.include('typed_properties');
    });
  });

  describe('searchFeaturesByExpressionTreeProperties', () => {
    it('should build a typed-property schema query over the filtered feature set', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ knex: knexSpy });
      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByExpressionTreeProperties('survey', undefined, 42);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('with "matching_features" as');
      expect(sql).to.include('"typed_property_rows" as');
      expect(sql).to.include('submission_feature_property_string');
      expect(sql).to.include('submission_feature_property_number');
      expect(sql).to.include('submission_feature_property_feature');
      expect(sql).to.include('"fpt"."name" as "type_name"');
      expect(sql).to.include('order by ftp.sort ASC NULLS LAST');
      expect(sql).to.not.include('jsonb_object_keys');
      expect(sql).to.not.include('typed_properties');
    });
  });
});
