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

  describe('computeAnchorsForScope', () => {
    it('declares cursor, fetches batches, inserts anchors, and closes cursor', async () => {
      const queryStub = sinon.stub();

      // Call 0: DECLARE CURSOR — no rows needed
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      // Call 1: FETCH — returns 2 features (less than batch size → last batch)
      queryStub.onCall(1).resolves({
        rows: [{ submission_feature_id: 101 }, { submission_feature_id: 102 }],
        rowCount: 2
      });

      // Call 2: INSERT batch via query (unnest)
      queryStub.onCall(2).resolves({ rows: [], rowCount: 2 });

      // Call 3: CLOSE cursor
      queryStub.onCall(3).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-1');

      // DECLARE was called with the securityScopeId parameter
      expect(queryStub.getCall(0).args[0]).to.include('DECLARE');
      expect(queryStub.getCall(0).args[0]).to.include('CURSOR FOR');
      expect(queryStub.getCall(0).args[1]).to.eql(['scope-uuid-1']);

      // FETCH was called
      expect(queryStub.getCall(1).args[0]).to.include('FETCH');

      // Batch INSERT via query
      expect(queryStub.getCall(2).args[0]).to.include('INSERT INTO security_scope_anchor');

      // CLOSE was called
      expect(queryStub.getCall(3).args[0]).to.include('CLOSE');
    });

    it('processes multiple batches when results exceed batch size', async () => {
      const queryStub = sinon.stub();

      // Call 0: DECLARE CURSOR
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });

      // Call 1: FETCH — returns full batch (5000 rows → more to fetch)
      const fullBatch = Array.from({ length: 5000 }, (_, i) => ({ submission_feature_id: i + 1 }));
      queryStub.onCall(1).resolves({ rows: fullBatch, rowCount: 5000 });

      // Call 2: INSERT batch 1 via query (unnest)
      queryStub.onCall(2).resolves({ rows: [], rowCount: 5000 });

      // Call 3: FETCH — returns partial batch (200 rows → last batch)
      const partialBatch = Array.from({ length: 200 }, (_, i) => ({ submission_feature_id: 5001 + i }));
      queryStub.onCall(3).resolves({ rows: partialBatch, rowCount: 200 });

      // Call 4: INSERT batch 2 via query (unnest)
      queryStub.onCall(4).resolves({ rows: [], rowCount: 200 });

      // Call 5: CLOSE cursor
      queryStub.onCall(5).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-2');

      // Two batch INSERTs via query
      const insertCalls = Array.from({ length: queryStub.callCount }, (_, i) => queryStub.getCall(i)).filter((call) =>
        call.args[0].includes('INSERT INTO security_scope_anchor')
      );
      expect(insertCalls).to.have.length(2);
    });

    it('skips insert when cursor returns no rows', async () => {
      const queryStub = sinon.stub();

      // Call 1: DECLARE CURSOR
      queryStub.onFirstCall().resolves({ rows: [], rowCount: 0 });

      // Call 2: FETCH — empty result
      queryStub.onSecondCall().resolves({ rows: [], rowCount: 0 });

      // Call 3: CLOSE cursor
      queryStub.onThirdCall().resolves({ rows: [], rowCount: 0 });

      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ query: queryStub, knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.computeAnchorsForScope('scope-uuid-3');

      // No INSERT called
      expect(knexFake).not.to.have.been.called;

      // Cursor was still closed
      expect(queryStub.thirdCall.args[0]).to.include('CLOSE');
    });

    it('closes cursor even when fetch throws', async () => {
      const queryStub = sinon.stub();

      // Call 1: DECLARE CURSOR
      queryStub.onFirstCall().resolves({ rows: [], rowCount: 0 });

      // Call 2: FETCH — throws
      queryStub.onSecondCall().rejects(new Error('fetch failed'));

      // Call 3: CLOSE cursor (called in finally)
      queryStub.onThirdCall().resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });

      const repository = new SecurityScopeRepository(mockDBConnection);

      try {
        await repository.computeAnchorsForScope('scope-uuid-4');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('fetch failed');
      }

      // Cursor was still closed via finally block
      expect(queryStub.thirdCall.args[0]).to.include('CLOSE');
    });
  });

  describe('deleteAnchorsForFeatures', () => {
    it('deletes anchor rows for the given submission feature IDs', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([], 3));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteAnchorsForFeatures([1, 2, 3]);

      expect(knexFake).to.have.been.calledOnce;
    });

    it('skips the query when given an empty array', async () => {
      const knexFake = sinon.fake.resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: knexFake });

      const repository = new SecurityScopeRepository(mockDBConnection);
      await repository.deleteAnchorsForFeatures([]);

      expect(knexFake).not.to.have.been.called;
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
