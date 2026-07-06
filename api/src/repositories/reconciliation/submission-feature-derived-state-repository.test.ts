import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { SubmissionFeatureDerivedStateRepository } from './submission-feature-derived-state-repository';

chai.use(sinonChai);

const UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * The key-based replacement join shared by all healing statements: the replacement is
 * the published live row with the ended row's (submission_id, feature_type_id, source_id).
 */
const expectReplacementJoin = (sqlText: string) => {
  expect(sqlText).to.include('repl.submission_id = old.submission_id');
  expect(sqlText).to.include('repl.feature_type_id = old.feature_type_id');
  expect(sqlText).to.include('repl.source_id = old.source_id');
  expect(sqlText).to.include('repl.record_end_date IS NULL');
  expect(sqlText).to.include('repl.record_effective_date IS NOT NULL');
};

describe('SubmissionFeatureDerivedStateRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('repointParentLinksToActiveRows', () => {
    it('re-points live children whose parent link targets an ended row', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 2));
      const repository = new SubmissionFeatureDerivedStateRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.repointParentLinksToActiveRows(42);

      expect(count).to.equal(2);
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SET parent_submission_feature_id = repl.submission_feature_id');
      expectReplacementJoin(sqlText);
      expect(sqlText).to.include('child.parent_submission_feature_id = old.submission_feature_id');
      expect(sqlText).to.include('old.record_end_date IS NOT NULL');
      // LEFT JOIN so a missing replacement nulls the parent link rather than skipping the row.
      expect(sqlText).to.include('LEFT JOIN submission_feature repl');
    });
  });

  describe('repointFeaturePropertyReferencesToActiveRows', () => {
    it('re-points references guarded against duplicates, then deletes stale leftovers', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureDerivedStateRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.repointFeaturePropertyReferencesToActiveRows(42);

      expect(count).to.equal(2);
      expect(sqlStub).to.have.been.calledTwice;

      const updateText = sqlStub.firstCall.args[0].text as string;
      expect(updateText).to.include('SET referenced_submission_feature_id = repl.submission_feature_id');
      expectReplacementJoin(updateText);
      expect(updateText).to.include('NOT EXISTS');

      const deleteText = sqlStub.secondCall.args[0].text as string;
      expect(deleteText).to.include('DELETE FROM submission_feature_property_feature');
      expect(deleteText).to.include('old.record_end_date IS NOT NULL');
    });
  });

  describe('repointFeatureRelationshipsToActiveRows', () => {
    it('re-points relationship targets with self-loop and duplicate guards, then deletes stale leftovers', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureDerivedStateRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.repointFeatureRelationshipsToActiveRows(42);

      expect(count).to.equal(2);
      expect(sqlStub).to.have.been.calledTwice;

      const updateText = sqlStub.firstCall.args[0].text as string;
      expect(updateText).to.include('SET target_feature_id = repl.submission_feature_id');
      expectReplacementJoin(updateText);
      expect(updateText).to.include('repl.submission_feature_id <> ff.source_feature_id');
      expect(updateText).to.include('NOT EXISTS');

      const deleteText = sqlStub.secondCall.args[0].text as string;
      expect(deleteText).to.include('DELETE FROM submission_feature_feature');
    });
  });

  describe('repointSecurityScopeAnchorsToActiveRows', () => {
    it('re-points anchors guarded against duplicate (scope, feature) pairs, then deletes stale leftovers', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repository = new SubmissionFeatureDerivedStateRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.repointSecurityScopeAnchorsToActiveRows(42);

      expect(count).to.equal(2);
      expect(sqlStub).to.have.been.calledTwice;

      const updateText = sqlStub.firstCall.args[0].text as string;
      expect(updateText).to.include('SET anchor_submission_feature_id = repl.submission_feature_id');
      expectReplacementJoin(updateText);
      expect(updateText).to.include('dup.security_scope_id = a.security_scope_id');

      const deleteText = sqlStub.secondCall.args[0].text as string;
      expect(deleteText).to.include('DELETE FROM security_scope_anchor');
    });
  });

  describe('carryForwardSecurityRulesToReplacementRows', () => {
    it('copies live active rules from superseded predecessors onto replacement rows', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 3));
      const repository = new SubmissionFeatureDerivedStateRepository(getMockDBConnection({ sql: sqlStub }));

      const count = await repository.carryForwardSecurityRulesToReplacementRows(UPLOAD_ID);

      expect(count).to.equal(3);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_feature_security');
      expect(sqlText).to.include("r.outcome = 'superseded'");
      expect(sqlText).to.include('s.submission_feature_id = r.previous_submission_feature_id');
      // Only live, confirmed rules are carried forward — drafts are regenerated by screening.
      expect(sqlText).to.include('s.record_end_date IS NULL');
      expect(sqlText).to.include("s.status = 'active'");
      // No unique key on (feature, rule) — duplicates are prevented via NOT EXISTS.
      expect(sqlText).to.include('NOT EXISTS');
    });
  });
});
