import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiGeneralError } from '../../errors/api-error';
import { CreateSubmissionFeatureIngestionRecord } from '../../models/submission-feature';
import { FeatureIngestionRepository } from './feature-ingestion-repository';

chai.use(sinonChai);

describe('FeatureIngestionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getActiveFeatureTypeMap', () => {
    it('returns active feature type rows', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { feature_type_id: 1, name: 'survey', display_name: 'Survey', description: null },
          { feature_type_id: 2, name: 'sample_site', display_name: 'Sample Site', description: null }
        ]
      } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      const result = await ingestionRepository.getActiveFeatureTypeMap();

      expect(result).to.deep.equal([
        { feature_type_id: 1, name: 'survey', display_name: 'Survey', description: null },
        { feature_type_id: 2, name: 'sample_site', display_name: 'Sample Site', description: null }
      ]);
    });
  });

  describe('getKnownFeatureTypeMap', () => {
    it('returns active and retired feature type rows without filtering on record_end_date', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [
          { feature_type_id: 1, name: 'dataset', display_name: 'Dataset', description: null },
          { feature_type_id: 2, name: 'survey', display_name: 'Survey', description: null }
        ]
      } as any as Promise<QueryResult<any>>;
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.not.match(/WHERE\s+record_end_date IS NULL/);
        return mockQueryResponse;
      });
      const ingestionRepository = new FeatureIngestionRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await ingestionRepository.getKnownFeatureTypeMap();

      expect(result).to.deep.equal([
        { feature_type_id: 1, name: 'dataset', display_name: 'Dataset', description: null },
        { feature_type_id: 2, name: 'survey', display_name: 'Survey', description: null }
      ]);
    });
  });

  describe('insertSubmissionFeatureRecordsByTypeId', () => {
    it('should build SQL with direct feature_type_id insert and bigint data_byte_size cast', async () => {
      const records = [
        {
          submissionId: 1,
          submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
          sourceId: 'feature-1',
          featureTypeId: 77,
          data: {
            id: 'feature-1',
            type: 'survey',
            properties: { name: 'Survey 1' },
            content: [],
            parent: null
          },
          dataByteSize: 123
        }
      ];

      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('::integer[]');
        expect(sqlStatement.text).to.include('::bigint[]');
        expect(sqlStatement.text).to.not.include('INNER JOIN feature_type');
        return Promise.resolve({ rowCount: 1, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.insertSubmissionFeatureRecordsByTypeId(records);

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('insertSubmissionFeatureRecord', () => {
    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      const feature: CreateSubmissionFeatureIngestionRecord = {
        submissionId: 1,
        submissionUploadId: 'some-upload-uuid',
        sourceId: '321',
        featureTypeName: 'type',
        data: {
          id: '321',
          type: 'type',
          properties: {
            name: 'feature'
          },
          content: [],
          parent: null
        },
        dataByteSize: 0
      };
      try {
        await ingestionRepository.insertSubmissionFeatureRecord({
          submissionId: feature.submissionId,
          submissionUploadId: feature.submissionUploadId,
          parentSubmissionFeatureId: 2,
          featureSourceId: feature.sourceId,
          featureTypeName: feature.featureTypeName,
          featureProperties: feature.data.properties,
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

      const feature: CreateSubmissionFeatureIngestionRecord = {
        submissionId: 1,
        submissionUploadId: 'some-upload-uuid',
        sourceId: '321',
        featureTypeName: 'type',
        data: {
          id: '321',
          type: 'type',
          properties: {
            name: 'feature'
          },
          content: [],
          parent: null
        },
        dataByteSize: 0
      };

      const response = await ingestionRepository.insertSubmissionFeatureRecord({
        submissionId: feature.submissionId,
        submissionUploadId: feature.submissionUploadId,
        parentSubmissionFeatureId: 2,
        featureSourceId: feature.sourceId,
        featureTypeName: feature.featureTypeName,
        featureProperties: feature.data.properties,
        dataByteSizeBytes: 0
      });

      expect(response).to.eql(mockResponse);
    });
  });

  describe('deleteSubmissionFeaturesBySubmissionUploadId', () => {
    it('should scope WHERE by submission_upload_id and pending effective rows', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('submission_upload_id');
        expect(sqlStatement.text).to.include('record_effective_date IS NULL');
        expect(sqlStatement.text).to.include('record_end_date IS NULL');
        return Promise.resolve({ rowCount: 2, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.deleteSubmissionFeaturesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub).to.have.been.calledOnce;
    });
  });
});
