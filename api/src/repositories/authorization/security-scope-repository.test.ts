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

  describe('findScopeIdsMatchingSubmission', () => {
    it('returns an array of security_scope_id strings', async () => {
      const mockRows = [
        { security_scope_id: 'scope-1', scope_hash: 'hash-1' },
        { security_scope_id: 'scope-2', scope_hash: 'hash-2' }
      ];

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResult(mockRows)
      });

      const repository = new SecurityScopeRepository(mockDBConnection);
      const result = await repository.findScopeIdsMatchingSubmission(42);

      expect(result).to.eql(['scope-1', 'scope-2']);
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
