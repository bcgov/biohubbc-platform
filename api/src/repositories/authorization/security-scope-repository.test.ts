import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SecurityScopeRepository } from './security-scope-repository';

chai.use(sinonChai);

describe('SecurityScopeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSecurityScope', () => {
    it('returns the inserted SecurityScope when scope_hash is new', async () => {
      const mockRow = {
        security_scope_id: '11111111-1111-1111-1111-111111111111',
        scope_hash: 'abc123hash',
        urn_submission_id: '*',
        urn_feature_type: '*',
        urn_feature_id: '*'
      };

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([mockRow])
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.insertSecurityScope('abc123hash');

      expect(result).to.eql(mockRow);
    });

    it('returns null when scope_hash already exists (ON CONFLICT DO NOTHING)', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([], 0)
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.insertSecurityScope('existing-hash');

      expect(result).to.be.null;
    });
  });

  describe('getSecurityScopeByScopeHash', () => {
    it('returns the SecurityScope when found', async () => {
      const mockRow = {
        security_scope_id: '11111111-1111-1111-1111-111111111111',
        scope_hash: 'abc123hash',
        urn_submission_id: '*',
        urn_feature_type: '*',
        urn_feature_id: '*'
      };

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([mockRow])
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.getSecurityScopeByScopeHash('abc123hash');

      expect(result).to.eql(mockRow);
    });

    it('throws ApiExecuteSQLError when no scope found', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([], 0)
      });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.getSecurityScopeByScopeHash('nonexistent-hash');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Security scope not found');
      }
    });
  });

  describe('ensureSecurityScope', () => {
    it('returns the inserted or existing SecurityScope from one SQL call', async () => {
      const mockRow = {
        security_scope_id: '11111111-1111-1111-1111-111111111111',
        scope_hash: 'abc123hash',
        urn_submission_id: '1',
        urn_feature_type: 'survey',
        urn_feature_id: '*'
      };
      const sqlFake = sinon.fake.resolves(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ sql: sqlFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.ensureSecurityScope('abc123hash', {
        urn_submission_id: '1',
        urn_feature_type: 'survey',
        urn_feature_id: '*'
      });

      expect(sqlFake).to.have.been.calledOnce;
      expect(result).to.eql(mockRow);
    });

    it('throws ApiExecuteSQLError when no row is returned', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([], 0)
      });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.ensureSecurityScope('missing-hash', {
          urn_submission_id: '1',
          urn_feature_type: 'survey',
          urn_feature_id: '*'
        });
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Failed to ensure security scope');
      }
    });
  });

  describe('deleteStaleAnchorBatch', () => {
    it('deletes stale anchors and returns pageLastId when stale anchors are found', async () => {
      const queryStub = sinon.stub();

      // Call 0: Batch query — returns 2 stale anchors
      queryStub.onCall(0).resolves({
        rows: [
          { anchor_submission_feature_id: 101, page_last_id: 200 },
          { anchor_submission_feature_id: 150, page_last_id: 200 }
        ],
        rowCount: 2
      });

      // Call 1: DELETE batch
      queryStub.onCall(1).resolves({ rows: [], rowCount: 2 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.deleteStaleAnchorBatch('scope-uuid-1', 0, null);

      expect(result).to.eql({ pageLastId: 200 });
      expect(queryStub.getCall(0).args[0]).to.include('NOT EXISTS');
      expect(queryStub.getCall(0).args[0]).to.include('closure_ready.source_submission_feature_id');
      expect(queryStub.getCall(1).args[0]).to.include('DELETE FROM security_scope_anchor');
      expect(queryStub.getCall(1).args[1]).to.include.deep.members(['scope-uuid-1', [101, 150]]);
    });

    it('advances keyset via boundary query when all anchors in batch are valid', async () => {
      const queryStub = sinon.stub();

      // Call 0: Batch query — empty (no stale anchors)
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      // Call 1: Boundary query — returns max ID
      queryStub.onCall(1).resolves({ rows: [{ last_id: 5000 }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.deleteStaleAnchorBatch('scope-uuid-1', 0, null);

      expect(result).to.eql({ pageLastId: 5000 });
      expect(queryStub.getCall(1).args[0]).to.include('SELECT MAX');
    });

    it('returns null when no more anchors exist', async () => {
      const queryStub = sinon.stub();

      // Call 0: Batch query — empty
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      // Call 1: Boundary query — null (no more anchors)
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.deleteStaleAnchorBatch('scope-uuid-1', 0, null);

      expect(result).to.be.null;
    });

    it('passes afterId to the batch query', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteStaleAnchorBatch('scope-uuid-1', 5000, null);

      // afterId=5000, securityScopeId, BATCH_SIZE=5000
      expect(queryStub.getCall(0).args[1]).to.eql(['scope-uuid-1', 5000, 5000]);
    });

    it('limits the batch and boundary scans to one submission when a submission is given', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteStaleAnchorBatch('scope-uuid-1', 0, 42);

      for (const call of [queryStub.getCall(0), queryStub.getCall(1)]) {
        expect(call.args[0]).to.include('scoped_anchor.submission_id = $4::integer');
        expect(call.args[1]).to.eql(['scope-uuid-1', 0, 5000, 42]);
      }
    });

    it('scans every anchor of the scope when no submission is given', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteStaleAnchorBatch('scope-uuid-1', 0, null);

      expect(queryStub.getCall(0).args[0]).not.to.include('scoped_anchor');
      expect(queryStub.getCall(1).args[0]).not.to.include('scoped_anchor');
    });
  });

  describe('resolveUrnForScope', () => {
    it('returns URN components when a matching policy statement exists', async () => {
      const urnRow = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };
      const queryStub = sinon.stub().resolves({ rows: [urnRow], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.resolveUrnForScope('scope-uuid-1');

      expect(result).to.eql(urnRow);
      expect(queryStub).to.have.been.calledOnce;
      expect(queryStub.getCall(0).args[1]).to.eql(['scope-uuid-1']);
    });

    it('returns null when no matching policy statement exists', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.resolveUrnForScope('scope-uuid-1');

      expect(result).to.be.null;
    });
  });

  describe('computeAnchorBatch', () => {
    const urn = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };

    it('inserts anchors and returns pageLastId when candidates are found', async () => {
      const queryStub = sinon.stub();

      // Call 0: Keyset batch — returns 2 anchors (after pruning)
      queryStub.onCall(0).resolves({
        rows: [
          { submission_feature_id: 101, page_last_id: 102 },
          { submission_feature_id: 102, page_last_id: 102 }
        ],
        rowCount: 2
      });

      // Call 1: INSERT batch
      queryStub.onCall(1).resolves({ rows: [], rowCount: 2 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.computeAnchorBatch('scope-uuid-1', urn, 0, null);

      expect(result).to.eql({ pageLastId: 102 });
      const batchSql = queryStub.getCall(0).args[0];
      expect(batchSql).to.include('closure_ready.source_submission_feature_id');
      expect(batchSql).to.include('JOIN submission_feature_closure ancestry');
      expect(batchSql).to.include('ancestry.is_ancestor = true');
      expect(batchSql).to.include('ancestry.target_submission_feature_id <> b.submission_feature_id');
      expect(batchSql).not.to.include('ancestor_walk');
      expect(batchSql).not.to.include('parent_submission_feature_id');
      expect(batchSql).not.to.include('WITH RECURSIVE');
      expect(queryStub.getCall(1).args[0]).to.include('INSERT INTO security_scope_anchor');
      expect(queryStub.getCall(1).args[1]).to.include.deep.members(['scope-uuid-1', [101, 102]]);
    });

    it('advances keyset via boundary query when all candidates are pruned', async () => {
      const queryStub = sinon.stub();

      // Call 0: Keyset batch — empty (all candidates pruned)
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      // Call 1: Boundary query — returns max ID
      queryStub.onCall(1).resolves({ rows: [{ last_id: 5000 }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.computeAnchorBatch('scope-uuid-1', urn, 0, null);

      expect(result).to.eql({ pageLastId: 5000 });
      expect(queryStub.getCall(1).args[0]).to.include('SELECT MAX');
    });

    it('returns null when no more candidates exist', async () => {
      const queryStub = sinon.stub();

      // Call 0: Keyset batch — empty
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      // Call 1: Boundary query — null (no more candidates)
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.computeAnchorBatch('scope-uuid-1', urn, 0, null);

      expect(result).to.be.null;
    });

    it('passes afterId and URN components to the batch query', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorBatch('scope-uuid-1', urn, 5000, null);

      // afterId=5000, urn components, BATCH_SIZE=5000
      expect(queryStub.getCall(0).args[1]).to.eql([5000, '*', 'telemetry', '*', 5000]);
    });

    it('applies the candidate rules to the batch and boundary scans and the ancestor rules to pruning', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorBatch('scope-uuid-1', urn, 0, null);

      for (const call of [queryStub.getCall(0), queryStub.getCall(1)]) {
        const sqlText: string = call.args[0];
        expect(sqlText).to.include('candidate.successor_submission_feature_id IS NULL');
        expect(sqlText).to.include('closure_ready.target_submission_feature_id = candidate.submission_feature_id');
        expect(sqlText).to.include("($2 = candidate.submission_id::text OR $2 = '*')");
        expect(sqlText).to.include("($3 = ft.name OR $3 = '*')");
        expect(sqlText).to.include("($4 = candidate.submission_feature_id::text OR $4 = '*')");
        expect(sqlText).to.include('c.source_submission_feature_id = candidate.submission_feature_id');
      }

      const batchSql: string = queryStub.getCall(0).args[0];
      expect(batchSql).to.include("($2 = ancestor.submission_id::text OR $2 = '*')");
      expect(batchSql).to.include("($4 = ancestor.submission_feature_id::text OR $4 = '*')");
      expect(batchSql).to.include('c.source_submission_feature_id = ancestor.submission_feature_id');
      // A pruning ancestor is not required to be current or to have a self-loop.
      expect(batchSql).not.to.include('ancestor.successor_submission_feature_id');
      expect(batchSql).not.to.include('closure_ready.target_submission_feature_id = ancestor.submission_feature_id');
    });

    it('adds an indexable submission predicate to the batch and boundary scans when a submission is given', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorBatch('scope-uuid-1', urn, 0, 42);

      for (const call of [queryStub.getCall(0), queryStub.getCall(1)]) {
        expect(call.args[0]).to.include('AND candidate.submission_id = $6::integer');
        expect(call.args[1]).to.eql([0, '*', 'telemetry', '*', 5000, 42]);
      }
    });

    it('omits the submission predicate when no submission is given', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorBatch('scope-uuid-1', urn, 0, null);

      expect(queryStub.getCall(0).args[0]).not.to.include('candidate.submission_id = $6');
      expect(queryStub.getCall(1).args[0]).not.to.include('candidate.submission_id = $6');
    });

    it('propagates errors from the keyset batch query', async () => {
      const queryStub = sinon.stub().rejects(new Error('query failed'));
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.computeAnchorBatch('scope-uuid-1', urn, 0, null);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('query failed');
      }
    });
  });

  describe('updateSecurityScopeFeatureIds', () => {
    const urn = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };

    it('rebuilds the bitmap in one statement without returning feature ids', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIds('scope-uuid-1', urn, null);

      expect(queryStub).to.have.been.calledOnce;
      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('UPDATE security_scope ss');
      expect(sqlText).to.include('SET feature_ids = rb_runoptimize(COALESCE((');
      expect(sqlText).to.include('rb_build_agg(member.submission_feature_id)');
      expect(sqlText).to.include("rb_build('{}'::integer[])");
      expect(sqlText).to.include('WHERE ss.security_scope_id = $1');
      expect(sqlText).not.to.include('RETURNING');
      expect(queryStub.firstCall.args[1]).to.eql(['scope-uuid-1', '*', 'telemetry', '*']);
    });

    it('derives anchors with the candidate and ancestor rules of computeAnchorBatch', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIds('scope-uuid-1', urn, null);

      const sqlText: string = queryStub.firstCall.args[0];

      // Anchor is a candidate: current, self-looped, URN match, effectively secured.
      expect(sqlText).to.include('anchor.successor_submission_feature_id IS NULL');
      expect(sqlText).to.include('closure_ready.target_submission_feature_id = anchor.submission_feature_id');
      expect(sqlText).to.include("($2 = anchor.submission_id::text OR $2 = '*')");
      expect(sqlText).to.include("($3 = anchor_ft.name OR $3 = '*')");
      expect(sqlText).to.include("($4 = anchor.submission_feature_id::text OR $4 = '*')");
      expect(sqlText).to.include('c.source_submission_feature_id = anchor.submission_feature_id');

      // No candidate proper ancestor: URN match and effectively secured, with no lifecycle test.
      expect(sqlText).to.include('ancestry.target_submission_feature_id <> anchor.submission_feature_id');
      expect(sqlText).to.include('ancestry.is_ancestor = true');
      expect(sqlText).to.include("($2 = ancestor.submission_id::text OR $2 = '*')");
      expect(sqlText).to.include("($3 = ancestor_ft.name OR $3 = '*')");
      expect(sqlText).to.include("($4 = ancestor.submission_feature_id::text OR $4 = '*')");
      expect(sqlText).to.include('c.source_submission_feature_id = ancestor.submission_feature_id');
      expect(sqlText).not.to.include('ancestor.successor_submission_feature_id');
    });

    it('collects the anchor and its descendants, limited to current features with a closure self-loop', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIds('scope-uuid-1', urn, null);

      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('reach.target_submission_feature_id = anchor.submission_feature_id');
      expect(sqlText).to.include('reach.is_ancestor = true');
      expect(sqlText).to.include('member.submission_feature_id = reach.source_submission_feature_id');
      expect(sqlText).to.include('member.successor_submission_feature_id IS NULL');
      expect(sqlText).to.include('member_ready.target_submission_feature_id = member.submission_feature_id');
      // Members are granted by ancestry alone: no URN or security test on them.
      expect(sqlText).not.to.include('= member.submission_id::text');
      expect(sqlText).not.to.include('c.source_submission_feature_id = member.submission_feature_id');
    });

    it('adds an indexable submission predicate on the anchor when a submission is given', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIds('scope-uuid-1', { ...urn, urn_submission_id: '42' }, 42);

      expect(queryStub.firstCall.args[0]).to.include('AND anchor.submission_id = $5::integer');
      expect(queryStub.firstCall.args[1]).to.eql(['scope-uuid-1', '42', 'telemetry', '*', 42]);
    });

    it('omits the submission predicate when no submission is given', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIds('scope-uuid-1', urn, null);

      expect(queryStub.firstCall.args[0]).not.to.include('anchor.submission_id = $5');
    });

    it('throws ApiExecuteSQLError when the scope row is not updated', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.updateSecurityScopeFeatureIds('scope-uuid-1', urn, null);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update security scope feature ids');
      }
    });

    it('propagates errors from the update', async () => {
      const queryStub = sinon.stub().rejects(new Error('query failed'));
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.updateSecurityScopeFeatureIds('scope-uuid-1', urn, null);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('query failed');
      }
    });
  });

  describe('updateSecurityScopeFeatureIdsForSubmission', () => {
    const urn = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };

    it("replaces the submission's ids in the stored bitmap in one statement", async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsForSubmission('scope-uuid-1', urn, 42);

      expect(queryStub).to.have.been.calledOnce;
      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('UPDATE security_scope ss');
      expect(sqlText).to.include(
        'SET feature_ids = rb_runoptimize(rb_or(rb_andnot(ss.feature_ids, part.submission_ids), part.fresh_ids))'
      );
      expect(sqlText).to.include('WHERE ss.security_scope_id = $1');
      expect(sqlText).not.to.include('RETURNING');
      expect(queryStub.firstCall.args[1]).to.eql(['scope-uuid-1', '*', 'telemetry', '*', 42]);
    });

    it('removes every feature id of the submission, current or not', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsForSubmission('scope-uuid-1', urn, 42);

      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('SELECT rb_build_agg(sf.submission_feature_id)');
      expect(sqlText).to.include('WHERE sf.submission_id = $5::integer');
      // No lifecycle test on the removed ids: superseded and ended features must leave the bitmap.
      expect(sqlText).not.to.include('sf.successor_submission_feature_id');
      expect(sqlText).not.to.include('sf.record_end_date');
    });

    it("adds back the full build's ids, always limited to the submission", async () => {
      const refreshQueryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const buildQueryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });

      await new SecurityScopeRepository(
        getMockDBConnection({ query: refreshQueryStub })
      ).updateSecurityScopeFeatureIdsForSubmission('scope-uuid-1', urn, 42);
      await new SecurityScopeRepository(getMockDBConnection({ query: buildQueryStub })).updateSecurityScopeFeatureIds(
        'scope-uuid-1',
        urn,
        42
      );

      const refreshSql: string = refreshQueryStub.firstCall.args[0];
      const buildSql: string = buildQueryStub.firstCall.args[0];

      // The subquery between the full build's COALESCE(( and its closing fallback is the shared text.
      const sharedSubquery = buildSql.slice(
        buildSql.indexOf('SELECT rb_build_agg(member.submission_feature_id)'),
        buildSql.indexOf("), rb_build('{}'::integer[])))")
      );

      expect(sharedSubquery).to.include('AND anchor.submission_id = $5::integer');
      expect(sharedSubquery).to.include('member_ready.target_submission_feature_id = member.submission_feature_id');
      expect(refreshSql).to.include(sharedSubquery);
    });

    it('skips a bitmap that was never built and a bitmap the refresh would not change', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsForSubmission('scope-uuid-1', urn, 42);

      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('AND ss.feature_ids IS NOT NULL');
      expect(sqlText).to.match(
        /AND ss\.feature_ids IS DISTINCT FROM\s+rb_runoptimize\(rb_or\(rb_andnot\(ss\.feature_ids, part\.submission_ids\), part\.fresh_ids\)\)/
      );
    });

    it('resolves when no row is updated', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsForSubmission('scope-uuid-1', urn, 42);

      expect(queryStub).to.have.been.calledOnce;
    });

    it('propagates errors from the update', async () => {
      const queryStub = sinon.stub().rejects(new Error('query failed'));
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.updateSecurityScopeFeatureIdsForSubmission('scope-uuid-1', urn, 42);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('query failed');
      }
    });
  });

  describe('lockSecurityScopeForFeatureIdsUpdate', () => {
    it("locks the scope's row with FOR NO KEY UPDATE in one statement", async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ '?column?': 1 }]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.lockSecurityScopeForFeatureIdsUpdate('scope-uuid-1');

      expect(sqlStub).to.have.been.calledOnce;
      const sqlStatement = sqlStub.firstCall.args[0];
      expect(sqlStatement.text).to.include('FROM security_scope WHERE security_scope_id = $1 FOR NO KEY UPDATE');
      expect(sqlStatement.values).to.eql(['scope-uuid-1']);
    });

    it('resolves when the scope row does not exist', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.lockSecurityScopeForFeatureIdsUpdate('scope-uuid-1');

      expect(sqlStub).to.have.been.calledOnce;
    });

    it('propagates errors from the lock', async () => {
      const sqlStub = sinon.stub().rejects(new Error('lock failed'));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.lockSecurityScopeForFeatureIdsUpdate('scope-uuid-1');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('lock failed');
      }
    });
  });

  describe('lockSecurityScopesForSubmissionFeatureIdsUpdate', () => {
    it('returns the locked scopes', async () => {
      const mockRows = [{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }];
      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult(mockRows)
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.lockSecurityScopesForSubmissionFeatureIdsUpdate(42);

      expect(result).to.eql([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
    });

    it('returns an empty array when no scope matches', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([])
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.lockSecurityScopesForSubmissionFeatureIdsUpdate(999);

      expect(result).to.eql([]);
    });

    it('locks scopes naming the submission and wildcard scopes, in id order, in one statement', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.lockSecurityScopesForSubmissionFeatureIdsUpdate(42);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlStatement = sqlStub.firstCall.args[0];
      expect(sqlStatement.text).to.include("WHERE urn_submission_id = $1 OR urn_submission_id = '*'");
      expect(sqlStatement.text).to.match(/ORDER BY security_scope_id\s+FOR NO KEY UPDATE/);
      expect(sqlStatement.values).to.eql(['42']);
    });

    it('locks scopes with or without a linked team and with or without a built bitmap', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.lockSecurityScopesForSubmissionFeatureIdsUpdate(42);

      const sqlText: string = sqlStub.firstCall.args[0].text;
      expect(sqlText).not.to.include('team_policy');
      expect(sqlText).not.to.include('feature_ids');
    });

    it('propagates errors from the lock', async () => {
      const sqlStub = sinon.stub().rejects(new Error('lock failed'));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.lockSecurityScopesForSubmissionFeatureIdsUpdate(42);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('lock failed');
      }
    });
  });

  describe('updateSecurityScopeFeatureIdsWithoutSubmission', () => {
    it("removes the submission's ids from the stored bitmaps in one statement", async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 2 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsWithoutSubmission(42);

      expect(queryStub).to.have.been.calledOnce;
      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('UPDATE security_scope ss');
      expect(sqlText).to.include('SET feature_ids = rb_runoptimize(rb_andnot(ss.feature_ids, part.submission_ids))');
      expect(sqlText).not.to.include('RETURNING');
      expect(queryStub.firstCall.args[1]).to.eql([42]);
    });

    it('removes every feature id of the submission, current or not', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsWithoutSubmission(42);

      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.match(
        /SELECT rb_build_agg\(sf\.submission_feature_id\)\s+FROM submission_feature sf\s+WHERE sf\.submission_id = \$1::integer\s+\), rb_build\('\{\}'::integer\[\]\)\) AS submission_ids/
      );
      expect(sqlText).not.to.include('record_end_date');
      expect(sqlText).not.to.include('successor_submission_feature_id');
    });

    it('clears scopes naming the submission and wildcard scopes, with or without a linked team', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsWithoutSubmission(42);

      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include("WHERE (ss.urn_submission_id = $1::text OR ss.urn_submission_id = '*')");
      expect(sqlText).not.to.include('team_policy');
    });

    it("skips a bitmap that was never built and a bitmap holding none of the submission's ids", async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 1 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsWithoutSubmission(42);

      const sqlText: string = queryStub.firstCall.args[0];
      expect(sqlText).to.include('AND ss.feature_ids IS NOT NULL');
      expect(sqlText).to.include('AND rb_intersect(ss.feature_ids, part.submission_ids)');
    });

    it('resolves when no row is updated', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.updateSecurityScopeFeatureIdsWithoutSubmission(42);

      expect(queryStub).to.have.been.calledOnce;
    });

    it('propagates errors from the update', async () => {
      const queryStub = sinon.stub().rejects(new Error('query failed'));
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.updateSecurityScopeFeatureIdsWithoutSubmission(42);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('query failed');
      }
    });
  });

  describe('findScopeIdsWithoutActiveApprovedAllowStatements', () => {
    it('returns scope IDs that have no remaining active approved ALLOW statement references', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([{ security_scope_id: 'scope-2' }]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsWithoutActiveApprovedAllowStatements(['scope-1', 'scope-2']);

      expect(knexFake).to.have.been.calledOnce;
      expect(result).to.eql([{ security_scope_id: 'scope-2' }]);
    });

    it('returns empty array when given empty input', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsWithoutActiveApprovedAllowStatements([]);

      expect(knexFake).not.to.have.been.called;
      expect(result).to.eql([]);
    });
  });

  describe('findScopeIdsMatchingSubmission', () => {
    it('returns an array of SecurityScopeId objects', async () => {
      const mockRows = [{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }];

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult(mockRows)
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsMatchingSubmission(42);

      expect(result).to.eql([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
    });

    it('returns an empty array when no scopes match', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult([])
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsMatchingSubmission(999);

      expect(result).to.eql([]);
    });

    it('filters to ALLOW statements on approved active policies with a live team_policy', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SecurityScopeRepository(mockDBConnection);

      await repository.findScopeIdsMatchingSubmission(42);

      const sqlText = sqlStub.firstCall.args[0].text.toLowerCase();
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlText).to.include('ps.effect =');
      expect(sqlText).to.include("p.status = 'approved'");
      expect(sqlText).to.include('p.record_end_date is null');
      expect(sqlText).to.include('join team_policy tp');
      expect(sqlText).to.include('tp.record_end_date is null');
      expect(sqlValues).to.include('allow');
    });
  });

  describe('team scope derivation guards', () => {
    it('insertTeamSecurityScopesForPolicy requires a live team_policy link and an ALLOW approved active policy + active team', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SecurityScopeRepository(mockDBConnection);

      await repository.insertTeamSecurityScopesForPolicy('team-1', 'policy-1');

      const sqlText = sqlStub.firstCall.args[0].text.toLowerCase();
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlText).to.include('from team_policy tp');
      expect(sqlText).to.include('tp.record_end_date is null');
      expect(sqlText).to.include('ps.effect =');
      expect(sqlText).to.include("p.status = 'approved'");
      expect(sqlText).to.include('p.record_end_date is null');
      expect(sqlText).to.include('t.record_end_date is null');
      expect(sqlValues).to.include('allow');
    });

    it('insertTeamSecurityScopesFromPolicyChain enforces active team and approved allow policy chain', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SecurityScopeRepository(mockDBConnection);

      await repository.insertTeamSecurityScopesFromPolicyChain('team-1');

      const sqlText = sqlStub.firstCall.args[0].text.toLowerCase();
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlText).to.include('join team t');
      expect(sqlText).to.include('t.record_end_date is null');
      expect(sqlText).to.include("p.status = 'approved'");
      expect(sqlText).to.include('ps.effect =');
      expect(sqlValues).to.include('allow');
    });
  });

  describe('resolveUrnForScope', () => {
    it('resolves only from ALLOW statements on approved active policies', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 0 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repository = new SecurityScopeRepository(mockDBConnection);

      await repository.resolveUrnForScope('scope-uuid-1');

      const sqlText = queryStub.firstCall.args[0].toLowerCase();
      expect(sqlText).to.include("ps.effect = 'allow'");
      expect(sqlText).to.include("p.status = 'approved'");
      expect(sqlText).to.include('p.record_end_date is null');
    });
  });

  describe('deleteStaleAnchorBatch', () => {
    it('validates anchors against ALLOW statements on approved active policies', async () => {
      const queryStub = sinon.stub();
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repository = new SecurityScopeRepository(mockDBConnection);

      await repository.deleteStaleAnchorBatch('scope-uuid-1', 0, null);

      const sqlText = queryStub.firstCall.args[0].toLowerCase();
      expect(sqlText).to.include("ps.effect = 'allow'");
      expect(sqlText).to.include("p.status = 'approved'");
      expect(sqlText).to.include('p.record_end_date is null');
    });
  });
});
