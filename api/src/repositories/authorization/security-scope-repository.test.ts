import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
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
        scope_hash: 'abc123hash'
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
        scope_hash: 'abc123hash'
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

  describe('deletePolicyStatementScopes', () => {
    it('deletes rows for the given policy statement IDs', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([], 2));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deletePolicyStatementScopes(['id-1', 'id-2']);

      expect(knexFake).to.have.been.calledOnce;
    });

    it('skips the query when given an empty array', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deletePolicyStatementScopes([]);

      expect(knexFake).not.to.have.been.called;
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
      const result = await repository.deleteStaleAnchorBatch('scope-uuid-1', 0);

      expect(result).to.eql({ pageLastId: 200 });
      expect(queryStub.getCall(0).args[0]).to.include('NOT EXISTS');
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
      const result = await repository.deleteStaleAnchorBatch('scope-uuid-1', 0);

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
      const result = await repository.deleteStaleAnchorBatch('scope-uuid-1', 0);

      expect(result).to.be.null;
    });

    it('passes afterId to the batch query', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteStaleAnchorBatch('scope-uuid-1', 5000);

      // afterId=5000, securityScopeId, BATCH_SIZE=5000
      expect(queryStub.getCall(0).args[1]).to.eql(['scope-uuid-1', 5000, 5000]);
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
      const result = await repository.computeAnchorBatch('scope-uuid-1', urn, 0);

      expect(result).to.eql({ pageLastId: 102 });
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
      const result = await repository.computeAnchorBatch('scope-uuid-1', urn, 0);

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
      const result = await repository.computeAnchorBatch('scope-uuid-1', urn, 0);

      expect(result).to.be.null;
    });

    it('passes afterId and URN components to the batch query', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorBatch('scope-uuid-1', urn, 5000);

      // afterId=5000, urn components, BATCH_SIZE=5000
      expect(queryStub.getCall(0).args[1]).to.eql([5000, '*', 'telemetry', '*', 5000]);
    });

    it('propagates errors from the keyset batch query', async () => {
      const queryStub = sinon.stub().rejects(new Error('query failed'));
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.computeAnchorBatch('scope-uuid-1', urn, 0);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('query failed');
      }
    });
  });

  describe('findScopeIdsForStatements', () => {
    it('returns distinct scope IDs for the given policy statement IDs', async () => {
      const knexFake = sinon.fake.resolves(
        mockQueryResult([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }])
      );
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsForStatements(['ps-1', 'ps-2']);

      expect(result).to.eql([{ security_scope_id: 'scope-1' }, { security_scope_id: 'scope-2' }]);
      expect(knexFake).to.have.been.calledOnce;
    });

    it('returns empty array when given empty input', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsForStatements([]);

      expect(result).to.eql([]);
      expect(knexFake).not.to.have.been.called;
    });
  });

  describe('findOrphanedScopeIds', () => {
    it('returns scope IDs that have no remaining policy_statement_scope references', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([{ security_scope_id: 'scope-2' }]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findOrphanedScopeIds(['scope-1', 'scope-2']);

      expect(knexFake).to.have.been.calledOnce;
      expect(result).to.eql([{ security_scope_id: 'scope-2' }]);
    });

    it('returns empty array when given empty input', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findOrphanedScopeIds([]);

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
    it('insertTeamSecurityScopesForPolicy only grants from ALLOW approved active policy and active team', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SecurityScopeRepository(mockDBConnection);

      await repository.insertTeamSecurityScopesForPolicy('team-1', 'policy-1');

      const sqlText = sqlStub.firstCall.args[0].text.toLowerCase();
      const sqlValues = sqlStub.firstCall.args[0].values;
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

      await repository.deleteStaleAnchorBatch('scope-uuid-1', 0);

      const sqlText = queryStub.firstCall.args[0].toLowerCase();
      expect(sqlText).to.include("ps.effect = 'allow'");
      expect(sqlText).to.include("p.status = 'approved'");
      expect(sqlText).to.include('p.record_end_date is null');
    });
  });
});
