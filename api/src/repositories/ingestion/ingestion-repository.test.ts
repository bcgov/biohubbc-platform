import { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { ApiGeneralError } from '../../errors/api-error';
import { FeatureTypeWithProperties, FeatureTypeWithPropertiesRow } from '../../models/feature-type';
import { getMockDBConnection } from '../../__mocks__/db';
import { IngestionRepository } from './ingestion-repository';

describe('IngestionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionFeatureRecord', () => {
    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const ingestionRepository = new IngestionRepository(mockDBConnection);

      const feature = {
        id: '',
        type: '',
        properties: {}
      };
      try {
        await ingestionRepository.insertSubmissionFeatureRecord(1, 'some-upload-uuid', 2, '321', 'type', feature, 0);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission feature record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const ingestionRepository = new IngestionRepository(mockDBConnection);

      const feature = {
        id: '',
        type: '',
        properties: {}
      };

      const response = await ingestionRepository.insertSubmissionFeatureRecord(
        1,
        'some-upload-uuid',
        2,
        '321',
        'type',
        feature,
        0
      );

      expect(response).to.eql(mockResponse);
    });
  });

  describe('updateSubmissionFeatureParent', () => {
    it('should update the parent submission feature id successfully', async () => {
      const mockQueryResponse: QueryResult<never> = {
        rowCount: 1,
        rows: [],
        command: '',
        oid: 0,
        fields: []
      };

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new IngestionRepository(mockDBConnection);

      await ingestionRepository.updateSubmissionFeatureParent(10, 5);

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('deleteSubmissionFeaturesBySubmissionUploadId', () => {
    it('should scope WHERE by submission_upload_id', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('submission_upload_id');
        expect(sqlStatement.text).to.include('record_end_date IS NULL');
        return Promise.resolve({ rowCount: 2, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new IngestionRepository(mockDBConnection);

      await ingestionRepository.deleteSubmissionFeaturesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('deleteSubmissionFeatures', () => {
    it('should soft delete all submission features for a submission', async () => {
      const mockQueryResponse: QueryResult<never> = {
        rowCount: 3,
        rows: [],
        command: '',
        oid: 0,
        fields: []
      };

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new IngestionRepository(mockDBConnection);

      await ingestionRepository.deleteSubmissionFeatures(1);

      expect(sqlStub).to.have.been.calledOnce;
    });

    it('should complete successfully even when no features exist to delete', async () => {
      const mockQueryResponse: QueryResult<never> = {
        rowCount: 0,
        rows: [],
        command: '',
        oid: 0,
        fields: []
      };

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new IngestionRepository(mockDBConnection);

      // Should not throw even when rowCount is 0
      await ingestionRepository.deleteSubmissionFeatures(999);

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('findFeatureTypeWithProperties', () => {
    it('should return feature type with properties when valid', async () => {
      const mockRows: FeatureTypeWithPropertiesRow[] = [
        {
          feature_type_id: 1,
          name: 'dataset',
          display_name: 'Dataset',
          properties: [
            {
              feature_type_property_id: 11,
              name: 'name',
              display_name: 'Name',
              description: 'The name of the dataset',
              type_name: 'string',
              allow_multiple: false,
              required_value: true,
              calculated_value: false
            },
            {
              feature_type_property_id: 12,
              name: 'description',
              display_name: 'Description',
              description: 'The description of the dataset',
              type_name: 'string',
              allow_multiple: false,
              required_value: false,
              calculated_value: false
            }
          ]
        }
      ];
      const mockQueryResponse: QueryResult<any> = {
        rowCount: mockRows.length,
        rows: mockRows,
        command: '',
        oid: 0,
        fields: []
      };

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const ingestionRepository = new IngestionRepository(mockDBConnection);
      const response = await ingestionRepository.findFeatureTypeWithProperties('dataset');

      const expectedResponse: FeatureTypeWithProperties = {
        featureType: {
          feature_type_id: 1,
          name: 'dataset',
          display_name: 'Dataset'
        },
        properties: [
          {
            feature_type_property_id: 11,
            name: 'name',
            display_name: 'Name',
            description: 'The name of the dataset',
            type_name: 'string',
            allow_multiple: false,
            required_value: true,
            calculated_value: false
          },
          {
            feature_type_property_id: 12,
            name: 'description',
            display_name: 'Description',
            description: 'The description of the dataset',
            type_name: 'string',
            allow_multiple: false,
            required_value: false,
            calculated_value: false
          }
        ]
      };

      expect(response).to.eql(expectedResponse);
    });

    it('should return null when feature type does not exist', async () => {
      const mockQueryResponse: QueryResult<any> = {
        rowCount: 0,
        rows: [],
        command: '',
        oid: 0,
        fields: []
      };

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const ingestionRepository = new IngestionRepository(mockDBConnection);
      const response = await ingestionRepository.findFeatureTypeWithProperties('nonexistent_type');

      expect(response).to.be.null;
    });

    it('should return empty properties array when type has no properties', async () => {
      const mockRows: FeatureTypeWithPropertiesRow[] = [
        {
          feature_type_id: 99,
          name: 'empty_type',
          display_name: 'Empty Type',
          properties: []
        }
      ];
      const mockQueryResponse: QueryResult<any> = {
        rowCount: mockRows.length,
        rows: mockRows,
        command: '',
        oid: 0,
        fields: []
      };

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const ingestionRepository = new IngestionRepository(mockDBConnection);
      const response = await ingestionRepository.findFeatureTypeWithProperties('empty_type');

      const expectedResponse: FeatureTypeWithProperties = {
        featureType: {
          feature_type_id: 99,
          name: 'empty_type',
          display_name: 'Empty Type'
        },
        properties: []
      };

      expect(response).to.eql(expectedResponse);
    });
  });
});
