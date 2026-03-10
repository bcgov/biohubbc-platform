import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionFeatureArtifactRepository } from './submission-feature-artifact-repository';

describe('SubmissionFeatureArtifactRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionFeatureArtifacts', () => {
    it('should bulk insert submission_feature_artifact rows', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('INSERT INTO submission_feature_artifact');
        expect(sqlStatement.text).to.include('submission_feature_id');
        expect(sqlStatement.text).to.include('artifact_id');
        expect(sqlStatement.text).to.include('VALUES');
        return Promise.resolve({
          rowCount: 2,
          rows: [{ submission_feature_artifact_id: 1 }, { submission_feature_artifact_id: 2 }],
          command: '',
          oid: 0,
          fields: []
        });
      });

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeatureArtifactRepository(mockDBConnection);

      await repository.insertSubmissionFeatureArtifacts([
        {
          submission_feature_id: 123,
          artifact_id: '550e8400-e29b-41d4-a716-446655440000'
        },
        {
          submission_feature_id: 124,
          artifact_id: '660e8400-e29b-41d4-a716-446655440001'
        }
      ]);

      expect(sqlStub).to.have.been.calledOnce;
    });

    it('should no-op on empty input', async () => {
      const sqlStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeatureArtifactRepository(mockDBConnection);

      await repository.insertSubmissionFeatureArtifacts([]);

      expect(sqlStub).to.not.have.been.called;
    });
  });

  describe('softDeleteBySubmissionUploadId', () => {
    it('should soft-delete submission_feature_artifact rows by submission_upload_id', async () => {
      const sqlStub = sinon.stub().callsFake((sqlStatement: { text: string }) => {
        expect(sqlStatement.text).to.include('UPDATE submission_feature_artifact');
        expect(sqlStatement.text).to.include('FROM submission_feature');
        expect(sqlStatement.text).to.include('sf.submission_upload_id');
        expect(sqlStatement.text).to.include('sf.record_end_date IS NULL');
        expect(sqlStatement.text).to.include('sfa.record_end_date IS NULL');
        return Promise.resolve({ rowCount: 2, rows: [], command: '', oid: 0, fields: [] });
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeatureArtifactRepository(mockDBConnection);

      await repository.softDeleteBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub).to.have.been.calledOnce;
    });
  });
});
