import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { SubmissionFeatureLogRepository } from './submission-feature-log-repository';

chai.use(sinonChai);

const UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('SubmissionFeatureLogRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSupersededLogRecordsFromReconciliation', () => {
    it('inserts one log row per superseded outcome and returns the count', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 2));
      const repository = new SubmissionFeatureLogRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.insertSupersededLogRecordsFromReconciliation(UPLOAD_ID);

      expect(count).to.equal(2);
      expect(sqlStub).to.have.been.calledOnce;

      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_feature_log');
      // Derived from the upload's superseded reconciliation outcomes only.
      expect(sqlText).to.include("r.outcome = 'superseded'");
      expect(sqlText).to.include("'superseded'::submission_feature_log_action");
      // Links the ended predecessor to its published replacement.
      expect(sqlText).to.include('prev_sf.submission_feature_id = r.previous_submission_feature_id');
      expect(sqlText).to.include('new_sf.submission_feature_id = r.submission_feature_id');
      // Snapshots both content hashes.
      expect(sqlText).to.include('prev_sf.content_hash');
      expect(sqlText).to.include('new_sf.content_hash');
      // A submission_feature_log_uk1 violation is a chain conflict and must raise, not be swallowed.
      expect(sqlText).to.not.include('ON CONFLICT');
    });

    it('returns 0 when the upload produced no superseded outcomes', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new SubmissionFeatureLogRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.insertSupersededLogRecordsFromReconciliation(UPLOAD_ID);

      expect(count).to.equal(0);
    });
  });
});
