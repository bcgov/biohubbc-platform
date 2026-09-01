import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
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

  describe('insertSubmissionFeatures', () => {
    it('should build SQL with direct feature_type_id insert, bigint data_byte_size cast, and content_hash column', async () => {
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
          dataByteSize: 123,
          contentHash: 'a'.repeat(64)
        }
      ];

      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('::integer[]');
        expect(sqlStatement.text).to.include('::bigint[]');
        expect(sqlStatement.text).to.include('content_hash');
        expect(sqlStatement.text).to.not.include('INNER JOIN feature_type');
        return Promise.resolve({ rowCount: 1, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.insertSubmissionFeatures(records);

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('updateSubmissionFeatureParentsBySubmissionUploadId', () => {
    it('resolves parents preferring the same upload with fallback to the submission published live rows', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [], command: '', oid: 0, fields: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.updateSubmissionFeatureParentsBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        42
      );

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SET parent_submission_feature_id');
      expect(sqlText).to.include('parent.submission_id =');
      expect(sqlText).to.include("parent.source_id = child.data->>'parent'");
      expect(sqlText).to.include('parent.record_effective_date <= now()');
      expect(sqlText).to.include('parent.successor_submission_feature_id IS NULL');
      expect(sqlText).to.include('parent.submission_upload_id =');
      expect(sqlText).to.include('LIMIT 1');
    });
  });

  describe('deleteSubmissionFeaturesBySubmissionUploadId', () => {
    it('should scope WHERE by submission_upload_id and pending effective rows', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('DELETE FROM submission_feature');
        expect(sqlStatement.text).to.include('submission_upload_id');
        expect(sqlStatement.text).to.include('record_effective_date IS NULL');
        expect(sqlStatement.text).to.not.include('record_effective_date IS NOT NULL');
        return Promise.resolve({ rowCount: 2, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.deleteSubmissionFeaturesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub).to.have.been.calledOnce;
    });
  });
});
