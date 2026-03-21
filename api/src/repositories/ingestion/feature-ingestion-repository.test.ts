import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../../errors/api-error';
import { FeatureTypeWithProperties, FeatureTypeWithPropertiesRow } from '../../models/feature-type';
import { CreateSubmissionFeatureIngestionRecord } from '../../models/submission-feature';
import { getMockDBConnection } from '../../__mocks__/db';
import { FeatureIngestionRepository } from './feature-ingestion-repository';

chai.use(sinonChai);

describe('FeatureIngestionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionFeatureRecords', () => {
    it('should build SQL with active feature type join and bigint data_byte_size cast', async () => {
      const records: CreateSubmissionFeatureIngestionRecord[] = [
        {
          submissionId: 1,
          submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
          sourceId: 'feature-1',
          featureTypeName: 'dataset',
          data: {
            id: 'feature-1',
            type: 'dataset',
            properties: { name: 'Dataset 1' },
            references: [],
            parent: null
          },
          dataByteSize: 123
        }
      ];

      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('::bigint[]');
        expect(sqlStatement.text).to.include('ft.name = staged.feature_type_name AND ft.record_end_date IS NULL');
        return Promise.resolve({ rowCount: 1, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.insertSubmissionFeatureRecords(records);

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('insertSubmissionFeatureRecord', () => {
    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      const feature = {
        name: 'feature'
      };
      try {
        await ingestionRepository.insertSubmissionFeatureRecord({
          submissionId: 1,
          submissionUploadId: 'some-upload-uuid',
          parentSubmissionFeatureId: 2,
          featureSourceId: '321',
          featureTypeName: 'type',
          featureProperties: feature,
          dataByteSizeBytes: 0
        });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission feature record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_feature_id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      const feature = {
        name: 'feature'
      };

      const response = await ingestionRepository.insertSubmissionFeatureRecord({
        submissionId: 1,
        submissionUploadId: 'some-upload-uuid',
        parentSubmissionFeatureId: 2,
        featureSourceId: '321',
        featureTypeName: 'type',
        featureProperties: feature,
        dataByteSizeBytes: 0
      });

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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

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
              required_value: true,
              calculated_value: false
            },
            {
              feature_type_property_id: 12,
              name: 'description',
              display_name: 'Description',
              description: 'The description of the dataset',
              type_name: 'string',
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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);
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
            required_value: true,
            calculated_value: false
          },
          {
            feature_type_property_id: 12,
            name: 'description',
            display_name: 'Description',
            description: 'The description of the dataset',
            type_name: 'string',
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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);
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

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);
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
