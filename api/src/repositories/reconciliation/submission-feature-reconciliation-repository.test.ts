import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { SubmissionFeatureReconciliationRepository } from './submission-feature-reconciliation-repository';

chai.use(sinonChai);

const UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('SubmissionFeatureReconciliationRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('deleteReconciliationRecordsBySubmissionUploadId', () => {
    it('deletes the upload-scoped reconciliation records', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.deleteReconciliationRecordsBySubmissionUploadId(UPLOAD_ID);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('DELETE FROM submission_upload_feature_reconciliation');
      expect(sqlText).to.include('submission_upload_id =');
    });
  });

  describe('insertReconciliationRecordsFromClassification', () => {
    it('classifies pending rows against the published baseline and returns the per-outcome tally rows', async () => {
      const outcomeCountRows = [
        { outcome: 'new', count: 2 },
        { outcome: 'unchanged', count: 1 },
        { outcome: 'superseded', count: 1 }
      ];
      const sqlStub = sinon.stub().resolves(mockQueryResult(outcomeCountRows, 3));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const rows = await repository.insertReconciliationRecordsFromClassification(UPLOAD_ID, 42);

      // The repository returns the raw (outcome, count) rows; the service assembles the counts object.
      expect(rows).to.eql(outcomeCountRows);

      const sqlText = sqlStub.firstCall.args[0].text as string;
      // Incoming = the upload's pending rows only (re-approval of an activated upload is a no-op).
      expect(sqlText).to.include('sf.record_end_date IS NULL');
      expect(sqlText).to.include('sf.record_effective_date IS NULL');
      // Baseline = the submission's published live rows with a source id.
      expect(sqlText).to.include('b.record_effective_date IS NOT NULL');
      expect(sqlText).to.include('b.source_id IS NOT NULL');
      // A NULL baseline hash always compares as changed (superseded, never unchanged).
      expect(sqlText).to.include("b.content_hash IS NOT NULL AND b.content_hash = i.content_hash THEN 'unchanged'");
      // Conflicts: missing source id or duplicate keys on either side, one row per key.
      expect(sqlText).to.include("i.source_id IS NULL OR i.key_count > 1 OR b.key_count > 1 THEN 'conflict'");
      expect(sqlText).to.include('DISTINCT ON (feature_type_id, source_id)');
      expect(sqlText).to.include('INSERT INTO submission_upload_feature_reconciliation');
      // The tally is aggregated in SQL — the repository does no row shaping.
      expect(sqlText).to.include('RETURNING outcome');
      expect(sqlText).to.include('SELECT outcome, COUNT(*)::integer AS count');
      expect(sqlText).to.include('GROUP BY outcome');
    });
  });

  describe('endSupersededBaselineRows', () => {
    it('soft-ends only the still-live superseded predecessors', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 3));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.endSupersededBaselineRows(UPLOAD_ID);

      expect(count).to.equal(3);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SET record_end_date = now()');
      expect(sqlText).to.include("r.outcome = 'superseded'");
      expect(sqlText).to.include('sf.submission_feature_id = r.previous_submission_feature_id');
      expect(sqlText).to.include('sf.record_end_date IS NULL');
    });
  });

  describe('endUnchangedIncomingRows', () => {
    it('soft-ends the upload pending duplicates for unchanged keys without touching the baseline', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 2));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.endUnchangedIncomingRows(UPLOAD_ID);

      expect(count).to.equal(2);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SET record_end_date = now()');
      expect(sqlText).to.include("r.outcome = 'unchanged'");
      // Targets this upload's pending rows via the reconciliation key, not the baseline row.
      expect(sqlText).to.include('sf.submission_upload_id =');
      expect(sqlText).to.include('sf.feature_type_id = r.feature_type_id');
      expect(sqlText).to.include('sf.source_id = r.source_id');
      expect(sqlText).to.include('sf.record_effective_date IS NULL');
    });
  });

  describe('endConflictIncomingRows', () => {
    it('soft-ends the upload pending rows for conflict keys, matching NULL source ids', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.endConflictIncomingRows(UPLOAD_ID);

      expect(count).to.equal(1);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SET record_end_date = now()');
      expect(sqlText).to.include("r.outcome = 'conflict'");
      expect(sqlText).to.include('sf.source_id IS NOT DISTINCT FROM r.source_id');
      expect(sqlText).to.include('sf.record_effective_date IS NULL');
    });
  });

  describe('publishIncomingRows', () => {
    it('publishes pending rows for new and superseded outcomes only', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 4));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.publishIncomingRows(UPLOAD_ID);

      expect(count).to.equal(4);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SET record_effective_date = now()');
      expect(sqlText).to.include("r.outcome IN ('new', 'superseded')");
      expect(sqlText).to.include('sf.submission_feature_id = r.submission_feature_id');
      expect(sqlText).to.include('sf.record_end_date IS NULL');
      expect(sqlText).to.include('sf.record_effective_date IS NULL');
    });
  });

  describe('getPendingDuplicateKeyRowCount', () => {
    it('counts live pending rows sharing a (feature_type_id, source_id) key', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ duplicate_row_count: 2 }], 1));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.getPendingDuplicateKeyRowCount(UPLOAD_ID);

      expect(count).to.equal(2);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('GROUP BY feature_type_id, source_id');
      expect(sqlText).to.include('HAVING COUNT(*) > 1');
      expect(sqlText).to.include('record_effective_date IS NULL');
      expect(sqlText).to.include('source_id IS NOT NULL');
    });

    it('returns 0 when no duplicates exist', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ duplicate_row_count: 0 }], 1));
      const repository = new SubmissionFeatureReconciliationRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.getPendingDuplicateKeyRowCount(UPLOAD_ID);

      expect(count).to.equal(0);
    });
  });
});
