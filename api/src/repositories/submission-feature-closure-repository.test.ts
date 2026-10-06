import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeatureClosureRepository } from './submission-feature-closure-repository';

chai.use(sinonChai);

describe('SubmissionFeatureClosureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('invalidateClosureForSubmission', () => {
    it('issues a single DELETE on the connection scoped by submission_id', async () => {
      const sqlSpy = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.invalidateClosureForSubmission(42);

      expect(sqlSpy).to.have.been.calledOnce;
      expect(sqlSpy.firstCall.args[0].text).to.match(/DELETE FROM submission_feature_closure/i);
      expect(sqlSpy.firstCall.args[0].text).to.include('sf.submission_id =');
    });
  });

  describe('computeClosureForSubmission', () => {
    it('issues a single INSERT and returns the row count (closure rows written)', async () => {
      const sqlSpy = sinon.stub().resolves(mockQueryResult([], 5));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      const result = await repository.computeClosureForSubmission(42);

      expect(sqlSpy).to.have.been.calledOnce;
      expect(sqlSpy.firstCall.args[0].text).to.match(/INSERT INTO submission_feature_closure/i);
      expect(result).to.equal(5);
    });

    it('returns 0 without throwing when no closure rows are written', async () => {
      const repository = new SubmissionFeatureClosureRepository(
        getMockDBConnection({ sql: () => Promise.resolve(mockQueryResult([], 0)) })
      );

      const result = await repository.computeClosureForSubmission(42);

      expect(result).to.equal(0);
    });

    it('selects the closure universe by submission_id, not submission_upload_id', async () => {
      const sqlSpy = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.computeClosureForSubmission(42);

      const sqlText = sqlSpy.firstCall.args[0].text;
      expect(sqlText).to.include('submission_id =');
      expect(sqlText).to.not.include('submission_upload_id =');
    });

    it('selects only active submission features for closure', async () => {
      const sqlSpy = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.computeClosureForSubmission(42);

      const sqlText = sqlSpy.firstCall.args[0].text;
      expect(sqlText).to.include('record_effective_date <= now()');
      expect(sqlText).to.include('record_end_date IS NULL OR now() < record_end_date');
    });

    it('resolves stored parent and property targets through successor lineage before graph recursion', async () => {
      const sqlSpy = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureClosureRepository(getMockDBConnection({ sql: sqlSpy }));

      await repository.computeClosureForSubmission(42);

      const sqlText = sqlSpy.firstCall.args[0].text;
      expect(sqlText).to.include('stored_targets AS');
      expect(sqlText).to.include('successor_walk AS');
      expect(sqlText).to.include('feature.successor_submission_feature_id AS resolved_id');
      expect(sqlText).to.include('NOT feature.successor_submission_feature_id = ANY(walk.path)');
      expect(sqlText).to.include('resolved.resolved_id AS target');
      expect(sqlText).to.include('resolved.original_id = child.parent_submission_feature_id');
      expect(sqlText).to.include('resolved.original_id = property.referenced_submission_feature_id');
      expect(sqlText).to.not.include('JOIN LATERAL');
      expect(sqlText).to.not.include('source_id');
      expect(sqlText).to.not.include('submission_upload_feature');
    });
  });
});
