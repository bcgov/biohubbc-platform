import { expect } from 'chai';
import dayjs from 'dayjs';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import {
  DatetimeSearchableRecord,
  NumberSearchableRecord,
  SearchFeatureResultWithRelevancy,
  SpatialSearchableRecord,
  StringSearchableRecord
} from '../services/search-feature-service.interface';
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

  describe('deleteSearchRecordsBySubmissionId', () => {
    it('should delete from all 4 search tables for the given submission', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.deleteSearchRecordsBySubmissionId(777);

      expect(knexSpy.callCount).to.equal(4);
    });

    it('should succeed when no existing records to delete', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.deleteSearchRecordsBySubmissionId(999);

      expect(knexSpy.callCount).to.equal(4);
    });
  });

  describe('insertSearchableDatetimeRecords', () => {
    it('should succeed on insert with matching row count', async () => {
      const mockRows: DatetimeSearchableRecord[] = [
        {
          search_datetime_id: 1,
          submission_feature_id: 1,
          feature_property_id: 5,
          value: new Date('2024-01-15').toISOString()
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.insertSearchableDatetimeRecords([
        {
          feature_property_id: 5,
          submission_feature_id: 1,
          value: new Date('2024-01-15').toISOString()
        }
      ]);

      expect(response).to.have.lengthOf(1);
      expect(response[0].search_datetime_id).to.equal(1);
    });

    it('should throw an exception if row count does not match', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      try {
        await repository.insertSearchableDatetimeRecords([
          {
            feature_property_id: 5,
            submission_feature_id: 1,
            value: new Date('2024-01-15').toISOString()
          }
        ]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable datetime records');
      }
    });
  });

  describe('insertSearchableNumberRecords', () => {
    it('should succeed on insert with matching row count', async () => {
      const mockRows: NumberSearchableRecord[] = [
        {
          search_number_id: 1,
          submission_feature_id: 1,
          feature_property_id: 3,
          value: 100
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.insertSearchableNumberRecords([
        {
          feature_property_id: 3,
          submission_feature_id: 1,
          value: 100
        }
      ]);

      expect(response).to.have.lengthOf(1);
      expect(response[0].search_number_id).to.equal(1);
      expect(response[0].value).to.equal(100);
    });

    it('should throw an exception if row count does not match', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      try {
        await repository.insertSearchableNumberRecords([
          {
            feature_property_id: 3,
            submission_feature_id: 1,
            value: 100
          }
        ]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable number records');
      }
    });
  });

  describe('insertSearchableSpatialRecords', () => {
    it('should succeed on insert with matching row count', async () => {
      const mockRows: SpatialSearchableRecord[] = [
        {
          search_spatial_id: 1,
          submission_feature_id: 1,
          feature_property_id: 7,
          value: { type: 'Point', coordinates: [-127, 49] }
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.insertSearchableSpatialRecords([
        {
          feature_property_id: 7,
          submission_feature_id: 1,
          value: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-127, 49] }
              }
            ]
          }
        }
      ]);

      expect(response).to.have.lengthOf(1);
      expect(response[0].search_spatial_id).to.equal(1);
    });

    it('should throw an exception if row count does not match', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      try {
        await repository.insertSearchableSpatialRecords([
          {
            feature_property_id: 7,
            submission_feature_id: 1,
            value: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [-127, 49] }
                }
              ]
            }
          }
        ]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable spatial records');
      }
    });
  });

  describe('insertSearchableStringRecords', () => {
    it('should succeed on insert with matching row count', async () => {
      const mockRows: StringSearchableRecord[] = [
        {
          search_string_id: 1,
          submission_feature_id: 1,
          feature_property_id: 1,
          value: 'Moose'
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.insertSearchableStringRecords([
        {
          feature_property_id: 1,
          submission_feature_id: 1,
          value: 'Moose'
        }
      ]);

      expect(response).to.have.lengthOf(1);
      expect(response[0].search_string_id).to.equal(1);
      expect(response[0].value).to.equal('Moose');
    });

    it('should throw an exception if row count does not match', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      try {
        await repository.insertSearchableStringRecords([
          {
            feature_property_id: 1,
            submission_feature_id: 1,
            value: 'Moose'
          }
        ]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable string records');
      }
    });
  });

  describe('searchFeaturesByFilters', () => {
    it('should return matching features with relevancy scores', async () => {
      const mockRows: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Study',
          feature_description: 'A study of moose',
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 0.8,
          create_date: dayjs().toISOString()
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters({
        keyword: 'moose'
      });

      expect(response).to.have.lengthOf(1);
      expect(response[0].submission_feature_id).to.equal(1);
      expect(response[0].relevancy_score).to.equal(0.8);
    });

    it('should return features filtered by feature type', async () => {
      const mockRows: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Wildlife Data',
          feature_description: null,
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 1.0,
          create_date: dayjs().toISOString()
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters({
        feature_types: ['dataset']
      });

      expect(response).to.have.lengthOf(1);
      expect(response[0].feature_type_name).to.equal('dataset');
    });

    it('should return features filtered by species', async () => {
      const mockRows: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 2,
          feature_type_name: 'sample',
          feature_name: 'Sample A',
          feature_description: null,
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 1.0,
          create_date: dayjs().toISOString()
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters({
        species: ['Alces alces']
      });

      expect(response).to.have.lengthOf(1);
      expect(response[0].submission_feature_id).to.equal(1);
    });

    it('should return features filtered by properties', async () => {
      const mockRows: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Data',
          feature_description: null,
          submission_name: 'Project',
          is_secured: false,
          relevancy_score: 1.0,
          create_date: dayjs().toISOString()
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters({
        properties: [
          {
            operand: 'and',
            conditions: [
              {
                name: 'count',
                operator: 'gt',
                value: '10'
              }
            ]
          }
        ]
      });

      expect(response).to.have.lengthOf(1);
    });

    it('should apply pagination to results', async () => {
      const mockRows: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Data 1',
          feature_description: null,
          submission_name: 'Project',
          is_secured: false,
          relevancy_score: 1.0,
          create_date: dayjs().toISOString()
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters(
        {
          keyword: 'data'
        },
        {
          page: 1,
          limit: 10
        }
      );

      expect(response).to.have.lengthOf(1);
    });

    it('should return empty array when no matches found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters({
        keyword: 'nonexistent'
      });

      expect(response).to.eql([]);
    });

    it('should return empty array with empty filters', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFilters({});

      expect(response).to.eql([]);
    });
  });

  describe('searchFeaturesByFiltersCount', () => {
    it('should return count of matching features', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 5 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFiltersCount({
        keyword: 'moose'
      });

      expect(response).to.equal(5);
    });

    it('should return zero when no matches found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 0 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFiltersCount({
        keyword: 'nonexistent'
      });

      expect(response).to.equal(0);
    });

    it('should count features filtered by feature type', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 3 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFiltersCount({
        feature_types: ['dataset']
      });

      expect(response).to.equal(3);
    });

    it('should count features filtered by properties', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 2 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFiltersCount({
        properties: [
          {
            operand: 'and',
            conditions: [
              {
                name: 'status',
                operator: 'eq',
                value: 'active'
              }
            ]
          }
        ]
      });

      expect(response).to.equal(2);
    });

    it('should return zero with empty filters', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 0 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFiltersCount({});

      expect(response).to.equal(0);
    });
  });

  describe('searchFeatureIdsByFilters', () => {
    it('should return empty array for empty filters', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeatureIdsByFilters({} as any);

      expect(response).to.deep.equal([]);
      expect(knexSpy.callCount).to.equal(0);
    });

    it('should return empty array for undefined filters', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 0, rows: [] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeatureIdsByFilters(undefined as any);

      expect(response).to.deep.equal([]);
      expect(knexSpy.callCount).to.equal(0);
    });

    it('should return rows with submission_feature_id for matching filters', async () => {
      const mockQueryResponse = mockQueryResult([{ submission_feature_id: 1 }, { submission_feature_id: 2 }], 2);

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeatureIdsByFilters({ keyword: 'moose' });

      expect(response).to.deep.equal([{ submission_feature_id: 1 }, { submission_feature_id: 2 }]);
    });

    it('should return empty array when DB returns no rows', async () => {
      const mockQueryResponse = mockQueryResult([], 0);

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeatureIdsByFilters({ keyword: 'nonexistent' });

      expect(response).to.deep.equal([]);
    });

    it('should call connection.knex exactly once', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ submission_feature_id: 10 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeatureIdsByFilters({ feature_types: ['dataset'] });

      expect(knexSpy.callCount).to.equal(1);
    });
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

      await repository.searchFeaturesByExpressionTree('dataset', expressionTree, undefined, 42);

      expect(subqueryStub.calledOnce).to.equal(true);
      expect(subqueryStub.getCall(0).args).to.deep.equal(['dataset', expressionTree, 42]);

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

      await repository.searchFeaturesByExpressionTree('dataset', expressionTree);

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
      expect(sql).to.not.include('"sf"."submission_feature_id" in');
      expect(sql).to.include('order by "submission_feature_id" asc');
      expect(sql).to.include('limit 25');
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

      const count = await repository.searchFeaturesByExpressionTreeCount('dataset', expressionTree, 42);

      expect(count).to.equal(7);
      expect(subqueryStub.calledOnce).to.equal(true);
      expect(subqueryStub.getCall(0).args).to.deep.equal(['dataset', expressionTree, 42]);

      const sql = knexSpy.getCall(0).args[0].toString();
      expect(sql).to.include('count(*)::integer as count');
      expect(sql).to.include('"sf"."submission_feature_id" in');
    });
  });

  describe('buildUserAccessFilter (via searchFeaturesByFilters)', () => {
    it('should not apply access filter when systemUserId is undefined (internal caller)', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ submission_feature_id: 1 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFilters({ keyword: 'moose' }, undefined, undefined);

      expect(knexSpy.callCount).to.be.greaterThan(0);
      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      // No walk-up ancestor check or is_secured WHERE filter applied for internal callers
      expect(sql).to.not.include('security_scope_anchor');
      expect(sql).to.not.include('team_security_scope');
    });

    it('should filter to unsecured-only when systemUserId is null (anonymous)', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ submission_feature_id: 1 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFilters({ keyword: 'moose' }, undefined, null);

      expect(knexSpy.callCount).to.be.greaterThan(0);
      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      expect(sql).to.include('is_secured');
      expect(sql).to.not.include('security_scope_anchor');
    });

    it('should apply walk-up ancestor check when systemUserId is a number (authenticated)', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ submission_feature_id: 1 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFilters({ keyword: 'moose' }, undefined, 42);

      expect(knexSpy.callCount).to.be.greaterThan(0);
      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('team_member');
      expect(sql).to.include('is_secured');
    });

    it('should include the systemUserId parameter in the walk-up SQL', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ submission_feature_id: 1 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFilters({ keyword: 'moose' }, undefined, 99);

      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      expect(sql).to.include('99');
    });
  });

  describe('buildUserAccessFilter (via searchFeaturesByFiltersCount)', () => {
    it('should not apply access filter when systemUserId is undefined', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ count: 5 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFiltersCount({ keyword: 'moose' }, undefined);

      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      expect(sql).to.not.include('security_scope_anchor');
    });

    it('should filter to unsecured-only when systemUserId is null', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ count: 3 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFiltersCount({ keyword: 'moose' }, null);

      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      expect(sql).to.include('is_secured');
      expect(sql).to.not.include('security_scope_anchor');
    });

    it('should apply walk-up ancestor check when systemUserId is a number', async () => {
      const knexSpy = Sinon.stub().resolves({ rowCount: 1, rows: [{ count: 3 }] });

      const mockDBConnection = getMockDBConnection({
        knex: knexSpy
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      await repository.searchFeaturesByFiltersCount({ keyword: 'moose' }, 42);

      const builtQuery = knexSpy.firstCall.args[0];
      const sql = builtQuery.toString();
      expect(sql).to.include('security_scope_anchor');
      expect(sql).to.include('team_security_scope');
      expect(sql).to.include('team_member');
    });
  });
});
