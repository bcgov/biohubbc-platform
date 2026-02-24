import { expect } from 'chai';
import dayjs from 'dayjs';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  DatetimeSearchableRecord,
  NumberSearchableRecord,
  SearchFeatureResultWithRelevancy,
  SpatialSearchableRecord,
  StringSearchableRecord
} from '../services/search-feature-service.interface';
import { getMockDBConnection } from '../__mocks__/db';
import { SearchFeatureRepository } from './search-feature-repository';

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

    it('should return zero when count row is undefined', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{}]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new SearchFeatureRepository(mockDBConnection);

      const response = await repository.searchFeaturesByFiltersCount({
        keyword: 'test'
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
});
