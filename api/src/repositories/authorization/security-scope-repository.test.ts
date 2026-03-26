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

  describe('deleteStaleAnchorsForScope', () => {
    it('issues a DELETE query with the security scope ID', async () => {
      const queryStub = sinon.stub().resolves({ rows: [], rowCount: 3 });
      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteStaleAnchorsForScope('scope-uuid-1');

      expect(queryStub).to.have.been.calledOnce;
      expect(queryStub.getCall(0).args[0]).to.include('DELETE FROM security_scope_anchor');
      expect(queryStub.getCall(0).args[0]).to.include('NOT EXISTS');
      expect(queryStub.getCall(0).args[1]).to.eql(['scope-uuid-1']);
    });
  });

  describe('computeAnchorsForScope', () => {
    const urnRow = { urn_submission_id: '*', urn_feature_type: 'telemetry', urn_feature_id: '*' };

    it('returns early when no matching URN exists for the scope', async () => {
      const queryStub = sinon.stub();

      // Call 0: URN lookup — no matching policy statement
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-1');

      // Only the URN lookup was called — no keyset batch, no INSERT
      expect(queryStub.callCount).to.equal(1);
    });

    it('inserts anchors from a single batch and terminates', async () => {
      const queryStub = sinon.stub();

      // Call 0: URN lookup
      queryStub.onCall(0).resolves({ rows: [urnRow], rowCount: 1 });

      // Call 1: Keyset batch — returns 2 anchors (after pruning)
      queryStub.onCall(1).resolves({
        rows: [
          { submission_feature_id: 101, page_last_id: 102 },
          { submission_feature_id: 102, page_last_id: 102 }
        ],
        rowCount: 2
      });

      // Call 2: INSERT batch
      queryStub.onCall(2).resolves({ rows: [], rowCount: 2 });

      // Call 3: Next keyset batch — empty (no more candidates)
      queryStub.onCall(3).resolves({ rows: [], rowCount: 0 });

      // Call 4: Boundary query — null (no more candidates past lastId)
      queryStub.onCall(4).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-2');

      // INSERT was called with the anchor IDs
      expect(queryStub.getCall(2).args[0]).to.include('INSERT INTO security_scope_anchor');
      expect(queryStub.getCall(2).args[1]).to.include.deep.members(['scope-uuid-2', [101, 102]]);
    });

    it('processes multiple batches and advances the keyset correctly', async () => {
      const queryStub = sinon.stub();

      // Call 0: URN lookup
      queryStub.onCall(0).resolves({ rows: [urnRow], rowCount: 1 });

      // Call 1: Keyset batch 1 — full batch of anchors
      const batch1 = Array.from({ length: 5000 }, (_, i) => ({
        submission_feature_id: i + 1,
        page_last_id: 5000
      }));
      queryStub.onCall(1).resolves({ rows: batch1, rowCount: 5000 });

      // Call 2: INSERT batch 1
      queryStub.onCall(2).resolves({ rows: [], rowCount: 5000 });

      // Call 3: Keyset batch 2 — partial batch (last page)
      const batch2 = Array.from({ length: 200 }, (_, i) => ({
        submission_feature_id: 5001 + i,
        page_last_id: 5200
      }));
      queryStub.onCall(3).resolves({ rows: batch2, rowCount: 200 });

      // Call 4: INSERT batch 2
      queryStub.onCall(4).resolves({ rows: [], rowCount: 200 });

      // Call 5: Next keyset batch — empty
      queryStub.onCall(5).resolves({ rows: [], rowCount: 0 });

      // Call 6: Boundary query — null → terminates
      queryStub.onCall(6).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-3');

      // Two INSERT calls
      const insertCalls = Array.from({ length: queryStub.callCount }, (_, i) => queryStub.getCall(i)).filter((call) =>
        call.args[0].includes('INSERT INTO security_scope_anchor')
      );
      expect(insertCalls).to.have.length(2);

      // Keyset advanced: batch 2 query uses lastId=5000 (page_last_id from batch 1)
      expect(queryStub.getCall(3).args[1]).to.include(5000);
    });

    it('advances keyset via boundary query when all candidates in a batch are pruned', async () => {
      const queryStub = sinon.stub();

      // Call 0: URN lookup
      queryStub.onCall(0).resolves({ rows: [urnRow], rowCount: 1 });

      // Call 1: Keyset batch — empty result (all candidates pruned by ancestor check)
      queryStub.onCall(1).resolves({ rows: [], rowCount: 0 });

      // Call 2: Boundary query — returns max ID to advance past the pruned batch
      queryStub.onCall(2).resolves({ rows: [{ last_id: 5000 }], rowCount: 1 });

      // Call 3: Next keyset batch — returns 1 anchor
      queryStub.onCall(3).resolves({
        rows: [{ submission_feature_id: 5050, page_last_id: 5050 }],
        rowCount: 1
      });

      // Call 4: INSERT
      queryStub.onCall(4).resolves({ rows: [], rowCount: 1 });

      // Call 5: Next keyset batch — empty
      queryStub.onCall(5).resolves({ rows: [], rowCount: 0 });

      // Call 6: Boundary query — null → terminates
      queryStub.onCall(6).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-4');

      // Boundary query was called to advance past the pruned batch
      expect(queryStub.getCall(2).args[0]).to.include('SELECT MAX');

      // INSERT was called for the anchor found after advancing
      expect(queryStub.getCall(4).args[0]).to.include('INSERT INTO security_scope_anchor');
    });

    it('terminates when no candidates exist for the scope', async () => {
      const queryStub = sinon.stub();

      // Call 0: URN lookup — scope has a valid URN
      queryStub.onCall(0).resolves({ rows: [urnRow], rowCount: 1 });

      // Call 1: Keyset batch — no candidates match
      queryStub.onCall(1).resolves({ rows: [], rowCount: 0 });

      // Call 2: Boundary query — null (no candidates at all)
      queryStub.onCall(2).resolves({ rows: [{ last_id: null }], rowCount: 1 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-5');

      // No INSERT was called
      const insertCalls = Array.from({ length: queryStub.callCount }, (_, i) => queryStub.getCall(i)).filter((call) =>
        call.args[0].includes('INSERT INTO security_scope_anchor')
      );
      expect(insertCalls).to.have.length(0);
    });

    it('propagates errors from the keyset batch query', async () => {
      const queryStub = sinon.stub();

      // Call 0: URN lookup
      queryStub.onCall(0).resolves({ rows: [urnRow], rowCount: 1 });

      // Call 1: Keyset batch — throws
      queryStub.onCall(1).rejects(new Error('query failed'));

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.computeAnchorsForScope('scope-uuid-6');
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

  describe('deleteAnchorsForOrphanedScopes', () => {
    it('deletes anchors for scopes with no remaining policy_statement_scope references', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([], 5));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteAnchorsForOrphanedScopes(['scope-1', 'scope-2']);

      expect(knexFake).to.have.been.calledOnce;
    });

    it('skips the query when given an empty array', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteAnchorsForOrphanedScopes([]);

      expect(knexFake).not.to.have.been.called;
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
  });
});
