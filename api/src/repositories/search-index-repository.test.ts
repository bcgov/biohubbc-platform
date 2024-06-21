import { expect } from 'chai';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { FeaturePropertyRecordWithPropertyTypeName, SearchIndexRepository } from './search-index-respository';

describe('SearchIndexRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('getFeaturePropertiesWithTypeNames', () => {
    it('returns an array of FeaturePropertyRecordWithPropertyTypeName', async () => {
      const rows: FeaturePropertyRecordWithPropertyTypeName[] = [
        {
          feature_property_type_name: 'number',
          feature_property_id: 8,
          feature_property_type_id: 2,
          name: 'count',
          display_name: 'Count',
          description: 'The count of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'object',
          feature_property_id: 4,
          feature_property_type_id: 6,
          name: 'date_range',
          display_name: 'Date Range',
          description: 'A date range',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 2,
          feature_property_type_id: 1,
          name: 'description',
          display_name: 'Description',
          description: 'The description of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'datetime',
          feature_property_id: 6,
          feature_property_type_id: 3,
          name: 'end_date',
          display_name: 'End Date',
          description: 'The end date of the record',
          parent_feature_property_id: 4,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'spatial',
          feature_property_id: 7,
          feature_property_type_id: 4,
          name: 'geometry',
          display_name: 'Geometry',
          description: 'The location of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 9,
          feature_property_type_id: 2,
          name: 'latitude',
          display_name: 'Latitude',
          description: 'The latitude of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 10,
          feature_property_type_id: 2,
          name: 'longitude',
          display_name: 'Longitude',
          description: 'The longitude of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 1,
          feature_property_type_id: 1,
          name: 'name',
          display_name: 'Name',
          description: 'The name of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 21,
          feature_property_type_id: 1,
          name: 'artifact_key',
          display_name: 'Key',
          description: 'The S3 storage key for an artifact',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 15:40:29.486362-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'datetime',
          feature_property_id: 5,
          feature_property_type_id: 3,
          name: 'start_date',
          display_name: 'Start Date',
          description: 'The start date of the record',
          parent_feature_property_id: 4,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 3,
          feature_property_type_id: 2,
          name: 'taxon_id',
          display_name: 'Taxonomy Id',
          description: 'The taxonomy Id associated to the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        }
      ];

      const mockQueryResponse = {
        rowCount: 1,
        rows
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return mockQueryResponse;
        }
      });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      const response = await searchIndexRepository.getFeaturePropertiesWithTypeNames();

      expect(response).to.eql([
        {
          feature_property_type_name: 'number',
          feature_property_id: 8,
          feature_property_type_id: 2,
          name: 'count',
          display_name: 'Count',
          description: 'The count of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'object',
          feature_property_id: 4,
          feature_property_type_id: 6,
          name: 'date_range',
          display_name: 'Date Range',
          description: 'A date range',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 2,
          feature_property_type_id: 1,
          name: 'description',
          display_name: 'Description',
          description: 'The description of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'datetime',
          feature_property_id: 6,
          feature_property_type_id: 3,
          name: 'end_date',
          display_name: 'End Date',
          description: 'The end date of the record',
          parent_feature_property_id: 4,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'spatial',
          feature_property_id: 7,
          feature_property_type_id: 4,
          name: 'geometry',
          display_name: 'Geometry',
          description: 'The location of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 9,
          feature_property_type_id: 2,
          name: 'latitude',
          display_name: 'Latitude',
          description: 'The latitude of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 10,
          feature_property_type_id: 2,
          name: 'longitude',
          display_name: 'Longitude',
          description: 'The longitude of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 1,
          feature_property_type_id: 1,
          name: 'name',
          display_name: 'Name',
          description: 'The name of the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 21,
          feature_property_type_id: 1,
          name: 'artifact_key',
          display_name: 'Key',
          description: 'The S3 storage key for an artifact',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 15:40:29.486362-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'datetime',
          feature_property_id: 5,
          feature_property_type_id: 3,
          name: 'start_date',
          display_name: 'Start Date',
          description: 'The start date of the record',
          parent_feature_property_id: 4,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 3,
          feature_property_type_id: 2,
          name: 'taxon_id',
          display_name: 'Taxonomy Id',
          description: 'The taxonomy Id associated to the record',
          parent_feature_property_id: null,
          calculated_value: false,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        }
      ]);
    });
  });

  describe('insertSearchableDatetimeRecords', () => {
    it('should succeed on insert', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ search_datetime_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      const response = await searchIndexRepository.insertSearchableDatetimeRecords([
        {
          feature_property_id: 1,
          submission_feature_id: 1,
          value: new Date('2024-01-15').toDateString()
        }
      ]);

      expect(response[0].search_datetime_id).to.equal(1);
    });

    it('should throw an exception if no rows are retured', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      try {
        await searchIndexRepository.insertSearchableDatetimeRecords([
          {
            feature_property_id: 1,
            submission_feature_id: 1,
            value: new Date('2024-01-15').toDateString()
          }
        ]);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable datetime records');
      }
    });
  });

  describe('insertSearchableNumberRecords', () => {
    it('should succeed on insert', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ search_number_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      const response = await searchIndexRepository.insertSearchableNumberRecords([
        {
          feature_property_id: 1,
          submission_feature_id: 1,
          value: 100
        }
      ]);

      expect(response[0].search_number_id).to.equal(1);
    });

    it('should throw an exception if no rows are retured', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      try {
        await searchIndexRepository.insertSearchableNumberRecords([
          {
            feature_property_id: 1,
            submission_feature_id: 1,
            value: 100
          }
        ]);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable number records');
      }
    });
  });

  describe('insertSearchableSpatialRecords', () => {
    it('should succeed on insert', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ search_spatial_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      const response = await searchIndexRepository.insertSearchableSpatialRecords([
        {
          feature_property_id: 1,
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

      expect(response[0].search_spatial_id).to.equal(1);
    });

    it('should throw an exception if no rows are retured', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      try {
        await searchIndexRepository.insertSearchableSpatialRecords([
          {
            feature_property_id: 1,
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
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable spatial records');
      }
    });
  });

  describe('insertSearchableStringRecords', () => {
    it('should succeed on insert', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ search_string_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: () => mockQueryResponse
      });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      const response = await searchIndexRepository.insertSearchableStringRecords([
        {
          feature_property_id: 1,
          submission_feature_id: 1,
          value: 'Test'
        }
      ]);

      expect(response[0].search_string_id).to.equal(1);
    });

    it('should throw an exception if no rows are retured', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const searchIndexRepository = new SearchIndexRepository(mockDBConnection);

      try {
        await searchIndexRepository.insertSearchableStringRecords([
          {
            feature_property_id: 1,
            submission_feature_id: 1,
            value: 'Test'
          }
        ]);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert searchable string records');
      }
    });
  });
});
