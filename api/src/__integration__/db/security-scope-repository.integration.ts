// Integration test for SecurityScopeRepository — verifies ON CONFLICT DO NOTHING
// behavior and team scope rebuild against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { computeScopeHash } from '../../utils/scope-hash';

const scopeUrn = (urn: string) => {
  const [, urnSubmissionId, urnFeatureType, urnFeatureId] = urn.split(':');
  return {
    urn_submission_id: urnSubmissionId,
    urn_feature_type: urnFeatureType,
    urn_feature_id: urnFeatureId
  };
};

describe('SecurityScopeRepository (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let repo: SecurityScopeRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    repo = new SecurityScopeRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  describe('insertSecurityScope', () => {
    it('should insert a new scope and return SecurityScope', async () => {
      const scopeHash = computeScopeHash(`urn:*:report:${randomUUID()}`);

      const result = await repo.insertSecurityScope(scopeHash, scopeUrn('urn:*:report:*'));

      expect(result).to.not.be.null;
      expect(result).to.have.property('security_scope_id').that.is.a('string');
      expect(result!.scope_hash).to.equal(scopeHash);
    });

    it('should return null on duplicate scope_hash (ON CONFLICT DO NOTHING)', async () => {
      const scopeHash = computeScopeHash('urn:10:survey:*');

      // First insert succeeds
      const first = await repo.insertSecurityScope(scopeHash, scopeUrn('urn:10:survey:*'));
      expect(first).to.not.be.null;

      // Second insert with same hash returns null
      const second = await repo.insertSecurityScope(scopeHash, scopeUrn('urn:10:survey:*'));
      expect(second).to.be.null;
    });
  });

  describe('getSecurityScopeByScopeHash', () => {
    it('should retrieve an existing scope by hash', async () => {
      const scopeHash = computeScopeHash(`urn:*:telemetry:${randomUUID()}`);
      const inserted = await repo.insertSecurityScope(scopeHash, scopeUrn('urn:*:telemetry:*'));

      const found = await repo.getSecurityScopeByScopeHash(scopeHash);

      expect(found.security_scope_id).to.equal(inserted!.security_scope_id);
      expect(found.scope_hash).to.equal(scopeHash);
    });

    it('should throw when scope does not exist', async () => {
      try {
        await repo.getSecurityScopeByScopeHash('nonexistent-hash');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Security scope not found');
      }
    });
  });

  describe('insertSecurityScope + getSecurityScopeByScopeHash round-trip', () => {
    it('should return the same ID via insert and get for the same hash', async () => {
      const scopeHash = computeScopeHash(`urn:*:sample_site:${randomUUID()}`);

      const inserted = await repo.insertSecurityScope(scopeHash, scopeUrn('urn:*:sample_site:*'));
      expect(inserted).to.not.be.null;

      const found = await repo.getSecurityScopeByScopeHash(scopeHash);
      expect(found.security_scope_id).to.equal(inserted!.security_scope_id);
    });
  });
});
