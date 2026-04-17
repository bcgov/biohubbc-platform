import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../../errors/api-error';
import { CreateSubmissionFeatureIngestionRecord } from '../../models/submission-feature';
import { getMockDBConnection } from '../../__mocks__/db';
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
          { feature_type_id: 1, name: 'dataset' },
          { feature_type_id: 2, name: 'sample_site' }
        ]
      } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      const result = await ingestionRepository.getActiveFeatureTypeMap();

      expect(result).to.deep.equal([
        { feature_type_id: 1, name: 'dataset' },
        { feature_type_id: 2, name: 'sample_site' }
      ]);
    });
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
            content: [],
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

    it('does not throw when inserted row count does not match records length', async () => {
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
            content: [],
            parent: null
          },
          dataByteSize: 123
        }
      ];

      const sqlStub = sinon.stub();
      sqlStub.onFirstCall().resolves({ rowCount: 0, rows: [], command: '', oid: 0, fields: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.insertSubmissionFeatureRecords(records);

      expect(sqlStub).to.have.been.calledOnce;
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
            type: 'dataset',
            properties: { name: 'Dataset 1' },
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
