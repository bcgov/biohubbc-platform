import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { isSubmissionFeatureActive } from '../sql-fragments';
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

  describe('insertSubmissionUploadFeatures', () => {
    it('inserts raw features into durable staging with reconciliation identity fields', async () => {
      const records = [
        {
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
          contentHash: 'a'.repeat(64),
          universalId: 'universal-feature-1'
        }
      ];

      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('::integer[]');
        expect(sqlStatement.text).to.include('::bigint[]');
        expect(sqlStatement.text).to.include('INSERT INTO submission_upload_feature');
        expect(sqlStatement.text).to.not.include('submission_id');
        expect(sqlStatement.text).to.include('content_hash');
        expect(sqlStatement.text).to.include('universal_id');
        expect(sqlStatement.text).to.not.include('INNER JOIN feature_type');
        return Promise.resolve({ rowCount: 1, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.insertSubmissionUploadFeatures(records);

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
      expect(sqlText).to.include(isSubmissionFeatureActive('parent'));
      expect(sqlText).to.include(isSubmissionFeatureActive('child'));
      expect(sqlText).to.include('FROM submission_upload_feature staged');
      expect(sqlText).to.include('staged.submission_feature_id = child.submission_feature_id');
      expect(sqlText).to.not.include('child.submission_upload_id');
      expect(sqlText).to.include('LIMIT 1');
    });
  });

  describe('deleteSubmissionUploadFeaturesForSubmissionUploadId', () => {
    it('deletes only raw staging rows scoped to the submission upload', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('DELETE FROM submission_upload_feature');
        expect(sqlStatement.text).to.include('submission_upload_id');
        return Promise.resolve({ rowCount: 2, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      await ingestionRepository.deleteSubmissionUploadFeaturesForSubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('hasSubmissionFeaturesForSubmissionUploadId', () => {
    it('checks whether retained upload features are referenced by any produced submission features', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('SELECT EXISTS');
        expect(sqlStatement.text).to.include('JOIN submission_upload_feature staged');
        expect(sqlStatement.text).to.include('feature.submission_upload_feature_id');
        expect(sqlStatement.text).to.not.include('feature.record_end_date');
        return Promise.resolve({ rowCount: 1, rows: [{ exists: true }], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const ingestionRepository = new FeatureIngestionRepository(mockDBConnection);

      expect(
        await ingestionRepository.hasSubmissionFeaturesForSubmissionUploadId('550e8400-e29b-41d4-a716-446655440000')
      ).to.equal(true);
    });
  });
});
