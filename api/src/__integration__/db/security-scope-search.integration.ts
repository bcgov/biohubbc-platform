// Integration test for security scope pipeline — verifies scope creation, anchor computation,
// team scope grants, orphan cleanup, and search access filtering against the real database.
//
// Tests use repository methods directly for scope setup (bypassing pg-boss which is not
// running in the make test-db environment). SecurityScopeService.cleanupScopesForDeletedStatements
// is safe to call directly as it only uses repository methods internally.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { computeScopeHash } from '../../utils/scope-hash';
import { createTestFeature, createTestFeaturesInBulk, createTestSubmission } from '../helpers/test-submission-helpers';

describe('Security scope search (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let scopeRepo: SecurityScopeRepository;
  let scopeService: SecurityScopeService;
  let searchRepo: SearchFeatureRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    scopeRepo = new SecurityScopeRepository(connection);
    scopeService = new SecurityScopeService(connection);
    searchRepo = new SearchFeatureRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Mark a submission feature as secured.
   * Uses security_rule_id 1 from seed data.
   */
  async function secureFeature(submissionFeatureId: number): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
      VALUES (${submissionFeatureId}, 1, ${systemUserId});
    `);
  }

  /**
   * Soft-delete the security record for a feature (makes it public again).
   */
  async function unsecureFeature(submissionFeatureId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature_security
      SET record_end_date = now()
      WHERE submission_feature_id = ${submissionFeatureId}
        AND record_end_date IS NULL;
    `);
  }

  async function createTeam(name: string): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO team (name, create_user)
      VALUES (${name}, ${systemUserId})
      RETURNING team_id;
    `);
    return result.rows[0].team_id;
  }

  async function addTeamMember(teamId: string, systemUserId: number): Promise<void> {
    const apiUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO team_member (team_id, system_user_id, create_user)
      VALUES (${teamId}, ${systemUserId}, ${apiUserId});
    `);
  }

  async function createPolicy(name: string): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO policy (name, create_user)
      VALUES (${name}, ${systemUserId})
      RETURNING policy_id;
    `);
    return result.rows[0].policy_id;
  }

  /**
   * Create a policy statement with the given URN.
   * The DB trigger auto-decomposes the URN into indexed columns.
   */
  async function createPolicyStatement(policyId: string, urn: string): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO policy_statement (policy_id, effect, submission_feature_urn, create_user)
      VALUES (${policyId}, 'allow', ${urn}, ${systemUserId})
      RETURNING policy_statement_id;
    `);
    return result.rows[0].policy_statement_id;
  }

  async function createTeamPolicy(teamId: string, policyId: string): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO team_policy (team_id, policy_id, create_user)
      VALUES (${teamId}, ${policyId}, ${systemUserId})
      RETURNING team_policy_id;
    `);
    return result.rows[0].team_policy_id;
  }

  /**
   * Compute anchors for a scope using the split repo API (resolveUrn + batch loop).
   * No commits between batches — stays in the test's wrapping transaction for rollback isolation.
   */
  async function computeAnchors(scopeId: string): Promise<void> {
    const urn = await scopeRepo.resolveUrnForScope(scopeId);

    if (!urn) {
      return;
    }

    let lastId = 0;

    while (true) {
      const batch = await scopeRepo.computeAnchorBatch(scopeId, urn, lastId);

      if (!batch) {
        break;
      }

      lastId = batch.pageLastId;
    }
  }

  /**
   * Set up the full scope chain for a policy statement, bypassing pg-boss:
   * 1. Create or get security_scope (deduped by scope_hash)
   * 2. Map policy_statement → security_scope
   * 3. Compute anchors synchronously
   * Returns the security_scope_id.
   */
  async function setupScopeChain(policyStatementId: string, urn: string): Promise<string> {
    const scopeHash = computeScopeHash(urn);
    const inserted = await scopeRepo.insertSecurityScope(scopeHash);

    const scopeId = inserted
      ? inserted.security_scope_id
      : (await scopeRepo.getSecurityScopeByScopeHash(scopeHash)).security_scope_id;

    await scopeRepo.insertPolicyStatementScope(policyStatementId, scopeId);
    await computeAnchors(scopeId);

    return scopeId;
  }

  /**
   * Full RBAC setup: policy → statement → scope chain → team → member → team-policy → team scopes.
   * Returns all created IDs for assertions.
   */
  async function setupFullAccess(
    urn: string,
    userId: number,
    teamName: string
  ): Promise<{ policyId: string; stmtId: string; scopeId: string; teamId: string }> {
    const policyId = await createPolicy(`${teamName}-policy`);
    const stmtId = await createPolicyStatement(policyId, urn);
    const scopeId = await setupScopeChain(stmtId, urn);

    const teamId = await createTeam(teamName);
    await addTeamMember(teamId, userId);
    await createTeamPolicy(teamId, policyId);
    await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

    return { policyId, stmtId, scopeId, teamId };
  }

  async function countAnchors(securityScopeId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer as count FROM security_scope_anchor
      WHERE security_scope_id = ${securityScopeId};
    `);
    return result.rows[0].count;
  }

  async function countTeamScopes(teamId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer as count FROM team_security_scope
      WHERE team_id = ${teamId};
    `);
    return result.rows[0].count;
  }

  async function getTeamScopeIds(teamId: string): Promise<string[]> {
    const result = await connection.sql(SQL`
      SELECT security_scope_id FROM team_security_scope
      WHERE team_id = ${teamId}
      ORDER BY security_scope_id;
    `);
    return result.rows.map((r: { security_scope_id: string }) => r.security_scope_id);
  }

  /**
   * Search features by type, filtered to a specific submission.
   * systemUserId: undefined = no filter, null = anonymous, number = authenticated.
   */
  async function searchInSubmission(
    submissionId: number,
    featureTypes: string[],
    systemUserId?: number | null
  ): Promise<{ submission_feature_id: number; is_secured: boolean }[]> {
    const results = await searchRepo.searchFeaturesByFilters({ feature_types: featureTypes }, undefined, systemUserId);
    return results
      .filter((r) => r.submission_id === submissionId)
      .map((r) => ({
        submission_feature_id: r.submission_feature_id,
        is_secured: r.is_secured
      }));
  }

  let _userSeq = 0;
  async function createOtherUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-scope-${Date.now()}-${++_userSeq}`;
    const result = await connection.sql(SQL`
      INSERT INTO "system_user" (user_identity_source_id, user_identifier, user_guid, record_effective_date, create_user)
      SELECT user_identity_source_id, ${guid}, ${guid}, now(), ${apiUserId}
      FROM user_identity_source
      WHERE record_end_date IS NULL
      LIMIT 1
      RETURNING system_user_id;
    `);
    return result.rows[0].system_user_id;
  }

  // ── Policy create → scope creation ───────────────────────────────────

  describe('Policy create → scope creation', () => {
    it('should create security_scope and policy_statement_scope mapping', async () => {
      const policyId = await createPolicy('scope-creation-test');
      const stmtId = await createPolicyStatement(policyId, 'urn:1:dataset:*');

      const scopeId = await setupScopeChain(stmtId, 'urn:1:dataset:*');

      // Verify scope exists with correct hash
      const scope = await scopeRepo.getSecurityScopeByScopeHash(computeScopeHash('urn:1:dataset:*'));
      expect(scope.security_scope_id).to.equal(scopeId);

      // Verify policy_statement_scope mapping
      const pssResult = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM policy_statement_scope
        WHERE policy_statement_id = ${stmtId} AND security_scope_id = ${scopeId};
      `);
      expect(pssResult.rows[0].count).to.equal(1);
    });

    it('should reuse the same scope for two policies with the same URN (dedup)', async () => {
      const urn = 'urn:1:telemetry:*';

      const policyA = await createPolicy('dedup-A');
      const stmtA = await createPolicyStatement(policyA, urn);
      const scopeIdA = await setupScopeChain(stmtA, urn);

      const policyB = await createPolicy('dedup-B');
      const stmtB = await createPolicyStatement(policyB, urn);
      const scopeIdB = await setupScopeChain(stmtB, urn);

      expect(scopeIdA).to.equal(scopeIdB);

      // Only one security_scope row for this hash
      const scopeCount = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM security_scope
        WHERE scope_hash = ${computeScopeHash(urn)};
      `);
      expect(scopeCount.rows[0].count).to.equal(1);
    });

    it('should compute anchors for matching secured features', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Anchor Target' });
      await secureFeature(featureId);

      const urn = `urn:${submissionId}:dataset:*`;
      const policyId = await createPolicy('anchor-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      // Verify the specific feature is an anchor
      const result = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId} AND anchor_submission_feature_id = ${featureId};
      `);
      expect(result.rows[0].count).to.equal(1);
    });

    it('should compute zero anchors when no matching secured features exist', async () => {
      const submissionId = await createTestSubmission(connection);
      await createTestFeature(connection, submissionId, 'dataset', { name: 'Unsecured' });

      const urn = `urn:${submissionId}:dataset:*`;
      const policyId = await createPolicy('no-anchor-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(0);
    });
  });

  // ── Team-policy create → team scope grants ───────────────────────────

  describe('Team-policy create → team scope grants', () => {
    it('should create team_security_scope rows when team-policy is assigned', async () => {
      const policyId = await createPolicy('team-grant-test');
      const stmtId = await createPolicyStatement(policyId, 'urn:*:*:*');
      await setupScopeChain(stmtId, 'urn:*:*:*');

      const teamId = await createTeam('Grant Test Team');
      await createTeamPolicy(teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      expect(await countTeamScopes(teamId)).to.equal(1);
    });

    it('should grant the same scope_id to two teams with the same policy', async () => {
      const policyId = await createPolicy('shared-policy');
      const stmtId = await createPolicyStatement(policyId, 'urn:*:telemetry:*');
      await setupScopeChain(stmtId, 'urn:*:telemetry:*');

      const teamA = await createTeam('Team A');
      await createTeamPolicy(teamA, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamA, policyId);

      const teamB = await createTeam('Team B');
      await createTeamPolicy(teamB, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamB, policyId);

      const scopeIdsA = await getTeamScopeIds(teamA);
      const scopeIdsB = await getTeamScopeIds(teamB);
      expect(scopeIdsA).to.deep.equal(scopeIdsB);
    });

    it('should accumulate scopes when a second policy is assigned to the same team', async () => {
      const policyA = await createPolicy('multi-policy-A');
      const stmtA = await createPolicyStatement(policyA, 'urn:1:dataset:*');
      await setupScopeChain(stmtA, 'urn:1:dataset:*');

      const policyB = await createPolicy('multi-policy-B');
      const stmtB = await createPolicyStatement(policyB, 'urn:2:dataset:*');
      await setupScopeChain(stmtB, 'urn:2:dataset:*');

      const teamId = await createTeam('Multi-Policy Team');
      await createTeamPolicy(teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      expect(await countTeamScopes(teamId)).to.equal(2);
    });

    it('should not create duplicate team_security_scope for the same scope via another policy', async () => {
      const urn = 'urn:*:species_observation:*';

      const policyA = await createPolicy('overlap-A');
      const stmtA = await createPolicyStatement(policyA, urn);
      await setupScopeChain(stmtA, urn);

      const policyB = await createPolicy('overlap-B');
      const stmtB = await createPolicyStatement(policyB, urn);
      await setupScopeChain(stmtB, urn);

      const teamId = await createTeam('Overlap Team');
      await createTeamPolicy(teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      // Same scope via two policies → one row (ON CONFLICT DO NOTHING)
      expect(await countTeamScopes(teamId)).to.equal(1);
    });
  });

  // ── Search with security scopes ──────────────────────────────────────

  describe('Search with security scopes', () => {
    it('should show authorized secured features to authenticated user with matching scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeature);

      const userId = connection.systemUserId();
      await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'Auth Team');

      const results = await searchInSubmission(submissionId, ['dataset'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(openFeature);
      expect(featureIds).to.include(securedFeature);

      const secured = results.find((r) => r.submission_feature_id === securedFeature);
      expect(secured?.is_secured).to.be.true;
    });

    it('should hide secured features from anonymous user', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeature);

      const results = await searchInSubmission(submissionId, ['dataset'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(openFeature);
      expect(featureIds).to.not.include(securedFeature);
    });

    it('should hide secured features from authenticated user without matching scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeature);

      // User exists but has no team/policy/scope
      const userId = await createOtherUser();

      const results = await searchInSubmission(submissionId, ['dataset'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(openFeature);
      expect(featureIds).to.not.include(securedFeature);
    });

    it('should hide descendant from anonymous when only the grandparent is secured (deep hierarchy)', async () => {
      // Hierarchy: dataset(secured) → sample_site(open) → species_observation(open)
      // The ancestor walk in buildSecurityFilter must find dataset's security row
      // two levels up from species_observation and hide it.
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Root' });
      const parent = await createTestFeature(
        connection,
        submissionId,
        'sample_site',
        { name: 'Open Mid' },
        grandparent
      );
      const child = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Open Leaf' },
        parent
      );

      // Only secure the root — descendants inherit security via ancestor walk
      await secureFeature(grandparent);

      const results = await searchInSubmission(submissionId, ['dataset', 'sample_site', 'species_observation'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      // All three should be hidden — grandparent is secured, and the ancestor walk
      // makes its descendants invisible to anonymous users
      expect(featureIds).to.not.include(grandparent);
      expect(featureIds).to.not.include(parent);
      expect(featureIds).to.not.include(child);
    });

    it('should grant authenticated user access to deep descendants via scope anchored at grandparent', async () => {
      // Hierarchy: dataset(secured) → sample_site(open) → species_observation(open)
      // Scope anchored at dataset. Authenticated user should see all three because
      // the ancestor walk finds the anchor in each feature's ancestor chain.
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Root' });
      const parent = await createTestFeature(
        connection,
        submissionId,
        'sample_site',
        { name: 'Open Mid' },
        grandparent
      );
      const child = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Open Leaf' },
        parent
      );

      await secureFeature(grandparent);

      const userId = connection.systemUserId();
      await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'Deep Access Team');

      const results = await searchInSubmission(submissionId, ['dataset', 'sample_site', 'species_observation'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      // All three visible — scope anchor at grandparent covers the entire subtree
      expect(featureIds).to.include(grandparent);
      expect(featureIds).to.include(parent);
      expect(featureIds).to.include(child);
    });

    it('should hide deep descendants from authenticated user without matching scope (deep hierarchy)', async () => {
      // Same hierarchy, but user has no scope — should behave like anonymous for secured subtree
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Root' });
      const parent = await createTestFeature(
        connection,
        submissionId,
        'sample_site',
        { name: 'Open Mid' },
        grandparent
      );
      const child = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Open Leaf' },
        parent
      );

      await secureFeature(grandparent);

      const userId = await createOtherUser();

      const results = await searchInSubmission(submissionId, ['dataset', 'sample_site', 'species_observation'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.not.include(grandparent);
      expect(featureIds).to.not.include(parent);
      expect(featureIds).to.not.include(child);
    });

    it('should grant access to all secured features via wildcard scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'DS 1' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'DS 2' });
      await secureFeature(feat1);
      await secureFeature(feat2);

      const userId = connection.systemUserId();
      await setupFullAccess('urn:*:*:*', userId, 'Wildcard Team');

      const results = await searchInSubmission(submissionId, ['dataset'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(feat1);
      expect(featureIds).to.include(feat2);
    });
  });

  // ── Policy deletion → scope cleanup ──────────────────────────────────

  describe('Policy deletion → scope cleanup', () => {
    it('should remove team_security_scope entries when policy statements are deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Test' });
      await secureFeature(featureId);

      const userId = connection.systemUserId();
      const { stmtId, teamId } = await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'Delete Scope Team');

      expect(await countTeamScopes(teamId)).to.be.greaterThan(0);

      // Soft-delete statement, then cleanup
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE policy_statement_id = ${stmtId};
      `);
      await scopeService.cleanupScopesForDeletedStatements([stmtId], [teamId]);

      expect(await countTeamScopes(teamId)).to.equal(0);
    });

    it('should delete orphaned security_scope_anchor rows when last reference is removed', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Orphan Anchor' });
      await secureFeature(featureId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('orphan-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      expect(await countAnchors(scopeId)).to.be.greaterThan(0);

      // Soft-delete statement and cleanup — scope becomes orphaned
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE policy_statement_id = ${stmtId};
      `);
      await scopeService.cleanupScopesForDeletedStatements([stmtId], []);

      // In prod the cleanup publishes a pg-boss job that calls computeAnchorsForScope.
      // pg-boss is not running in make test-db, so invoke the service directly.
      await scopeService.computeAnchorsForScope(scopeId);

      // Anchors deleted because scope has no remaining policy_statement_scope references
      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should preserve anchors for shared scopes when one policy is deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Shared Scope' });
      await secureFeature(featureId);

      // Two policies with the same URN → shared scope
      const urn = `urn:${submissionId}:*:*`;

      const policyA = await createPolicy('shared-A');
      const stmtA = await createPolicyStatement(policyA, urn);
      const scopeId = await setupScopeChain(stmtA, urn);

      const policyB = await createPolicy('shared-B');
      const stmtB = await createPolicyStatement(policyB, urn);
      await setupScopeChain(stmtB, urn); // Same scope reused

      const anchorsBefore = await countAnchors(scopeId);
      expect(anchorsBefore).to.be.greaterThan(0);

      // Delete policy A's statement — scope still referenced by policy B
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE policy_statement_id = ${stmtA};
      `);
      await scopeService.cleanupScopesForDeletedStatements([stmtA], []);

      // Anchors preserved — scope is NOT orphaned
      expect(await countAnchors(scopeId)).to.equal(anchorsBefore);
    });

    it('should block search access after policy deletion makes scope orphaned', async () => {
      const submissionId = await createTestSubmission(connection);
      const securedFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Soon Hidden' });
      await secureFeature(securedFeature);

      const userId = connection.systemUserId();
      const { stmtId, teamId } = await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'Block Team');

      // Before: user can see the secured feature
      const before = await searchInSubmission(submissionId, ['dataset'], userId);
      expect(before.map((r) => r.submission_feature_id)).to.include(securedFeature);

      // Delete: soft-delete statement and cleanup
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE policy_statement_id = ${stmtId};
      `);
      await scopeService.cleanupScopesForDeletedStatements([stmtId], [teamId]);

      // After: user can no longer see the secured feature
      const after = await searchInSubmission(submissionId, ['dataset'], userId);
      expect(after.map((r) => r.submission_feature_id)).to.not.include(securedFeature);
    });
  });

  // ── Policy update → scope replacement ────────────────────────────────

  describe('Policy update → scope replacement', () => {
    it('should replace scopes and clean up orphaned anchors when statements are updated', async () => {
      // Two submissions, each with a secured feature
      const sub1 = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, sub1, 'dataset', { name: 'Sub1 DS' });
      await secureFeature(feat1);

      const sub2 = await createTestSubmission(connection);
      const feat2 = await createTestFeature(connection, sub2, 'dataset', { name: 'Sub2 DS' });
      await secureFeature(feat2);

      // Policy initially targets sub1
      const policyId = await createPolicy('update-test');
      const oldStmtId = await createPolicyStatement(policyId, `urn:${sub1}:*:*`);
      const oldScopeId = await setupScopeChain(oldStmtId, `urn:${sub1}:*:*`);

      const userId = connection.systemUserId();
      const teamId = await createTeam('Update Team');
      await addTeamMember(teamId, userId);
      await createTeamPolicy(teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      // Before: sub1 accessible, sub2 not
      expect((await searchInSubmission(sub1, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat1
      );
      expect((await searchInSubmission(sub2, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.not.include(
        feat2
      );

      // Simulate update: soft-delete old statement, cleanup, create new for sub2
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE policy_statement_id = ${oldStmtId};
      `);
      await scopeService.cleanupScopesForDeletedStatements([oldStmtId], [teamId]);

      // In prod the cleanup publishes a pg-boss job that calls computeAnchorsForScope.
      // pg-boss is not running in make test-db, so invoke the service directly.
      await scopeService.computeAnchorsForScope(oldScopeId);

      // Old scope's anchors cleaned up (orphaned)
      expect(await countAnchors(oldScopeId)).to.equal(0);

      // Create new statement and scope chain for sub2
      const newStmtId = await createPolicyStatement(policyId, `urn:${sub2}:*:*`);
      await setupScopeChain(newStmtId, `urn:${sub2}:*:*`);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // After: sub2 accessible, sub1 not
      expect((await searchInSubmission(sub1, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.not.include(
        feat1
      );
      expect((await searchInSubmission(sub2, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat2
      );
    });
  });

  // ── Team-policy deletion → access removal ────────────────────────────

  describe('Team-policy deletion → access removal', () => {
    it('should remove team access and block search when team-policy is deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const securedFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Team Access' });
      await secureFeature(securedFeature);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('team-delete-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      await setupScopeChain(stmtId, urn);

      const userId = connection.systemUserId();
      const teamId = await createTeam('Team Delete');
      await addTeamMember(teamId, userId);
      const teamPolicyId = await createTeamPolicy(teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      // Before: user can see secured feature
      const before = await searchInSubmission(submissionId, ['dataset'], userId);
      expect(before.map((r) => r.submission_feature_id)).to.include(securedFeature);

      // Soft-delete team-policy, rebuild team scopes
      await connection.sql(SQL`
        UPDATE team_policy SET record_end_date = now()
        WHERE team_policy_id = ${teamPolicyId};
      `);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // team_security_scope rows removed
      expect(await countTeamScopes(teamId)).to.equal(0);

      // After: user can no longer see secured feature
      const after = await searchInSubmission(submissionId, ['dataset'], userId);
      expect(after.map((r) => r.submission_feature_id)).to.not.include(securedFeature);
    });

    it('should preserve scopes from remaining policies when one team-policy is deleted', async () => {
      // Team has Policy A (sub1 scope) and Policy B (sub2 scope).
      // Deleting team-policy A should leave sub2's scope intact.
      const sub1 = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, sub1, 'dataset', { name: 'Sub1 Secured' });
      await secureFeature(feat1);

      const sub2 = await createTestSubmission(connection);
      const feat2 = await createTestFeature(connection, sub2, 'dataset', { name: 'Sub2 Secured' });
      await secureFeature(feat2);

      // Policy A covers sub1, Policy B covers sub2
      const policyA = await createPolicy('multi-tp-A');
      const stmtA = await createPolicyStatement(policyA, `urn:${sub1}:*:*`);
      await setupScopeChain(stmtA, `urn:${sub1}:*:*`);

      const policyB = await createPolicy('multi-tp-B');
      const stmtB = await createPolicyStatement(policyB, `urn:${sub2}:*:*`);
      await setupScopeChain(stmtB, `urn:${sub2}:*:*`);

      const userId = connection.systemUserId();
      const teamId = await createTeam('Multi-Policy Team');
      await addTeamMember(teamId, userId);

      const tpA = await createTeamPolicy(teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      // Before: user sees both secured features, team has 2 scopes
      expect(await countTeamScopes(teamId)).to.equal(2);
      expect((await searchInSubmission(sub1, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat1
      );
      expect((await searchInSubmission(sub2, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat2
      );

      // Delete team-policy A, rebuild
      await connection.sql(SQL`
        UPDATE team_policy SET record_end_date = now()
        WHERE team_policy_id = ${tpA};
      `);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // After: team has 1 scope, sub2 still accessible, sub1 blocked
      expect(await countTeamScopes(teamId)).to.equal(1);
      expect((await searchInSubmission(sub2, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat2
      );
      expect((await searchInSubmission(sub1, ['dataset'], userId)).map((r) => r.submission_feature_id)).to.not.include(
        feat1
      );
    });

    it('should preserve overlapping scope when one of two team-policies sharing it is deleted', async () => {
      // Policy A and Policy B both use same URN → same shared scope.
      // Deleting team-policy A should leave the scope intact via Policy B.
      const submissionId = await createTestSubmission(connection);
      const securedFeature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Overlap' });
      await secureFeature(securedFeature);

      const urn = `urn:${submissionId}:*:*`;

      const policyA = await createPolicy('overlap-tp-A');
      const stmtA = await createPolicyStatement(policyA, urn);
      await setupScopeChain(stmtA, urn);

      const policyB = await createPolicy('overlap-tp-B');
      const stmtB = await createPolicyStatement(policyB, urn);
      await setupScopeChain(stmtB, urn); // Same scope reused

      const userId = connection.systemUserId();
      const teamId = await createTeam('Overlap TP Team');
      await addTeamMember(teamId, userId);

      const tpA = await createTeamPolicy(teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      // Before: 1 scope (deduped), user sees secured feature
      expect(await countTeamScopes(teamId)).to.equal(1);
      expect(
        (await searchInSubmission(submissionId, ['dataset'], userId)).map((r) => r.submission_feature_id)
      ).to.include(securedFeature);

      // Delete team-policy A, rebuild
      await connection.sql(SQL`
        UPDATE team_policy SET record_end_date = now()
        WHERE team_policy_id = ${tpA};
      `);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // After: still 1 scope (via Policy B), user still sees feature
      expect(await countTeamScopes(teamId)).to.equal(1);
      expect(
        (await searchInSubmission(submissionId, ['dataset'], userId)).map((r) => r.submission_feature_id)
      ).to.include(securedFeature);
    });
  });

  // ── Security rule mutations → anchor updates ─────────────────────────

  describe('Security rule mutations → anchor updates', () => {
    it('should compute new anchors when security rules are applied to features matching existing scopes', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Already Secured' });
      await secureFeature(feat1);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('new-anchor-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchorsBefore = await countAnchors(scopeId);

      // Secure a NEW feature in the same submission
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Newly Secured' });
      await secureFeature(feat2);

      // Recompute anchors — new secured feature should become an anchor
      await computeAnchors(scopeId);

      expect(await countAnchors(scopeId)).to.be.greaterThan(anchorsBefore);

      const result = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId} AND anchor_submission_feature_id = ${feat2};
      `);
      expect(result.rows[0].count).to.equal(1);
    });

    it('should exclude secured child when unsecured middle separates it from secured grandparent', async () => {
      // Hierarchy: grandparent → parent → child
      // Secured:   YES            NO        YES
      //
      // This is the key regression test for the recursive ancestor walk.
      // A single-level parent check would see child's immediate parent (parent) is
      // NOT secured and incorrectly make child an anchor. The recursive walk finds
      // grandparent (secured) two levels up and correctly excludes child.
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'dataset', { name: 'Grandparent' });
      const parent = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Parent' }, grandparent);
      const child = await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parent);

      // Secure grandparent and child, but NOT parent — gap in the chain
      await secureFeature(grandparent);
      await secureFeature(child);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('gap-hierarchy-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId}
        ORDER BY anchor_submission_feature_id;
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      // Grandparent is the root secured feature — it IS an anchor
      expect(anchorIds).to.include(grandparent);
      // Child has a secured ancestor (grandparent) — it is NOT an anchor
      expect(anchorIds).to.not.include(child);
    });

    it('should anchor a secured leaf when no ancestor is secured', async () => {
      // Hierarchy: grandparent → parent → child
      // Secured:   NO             NO       YES
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'dataset', { name: 'Grandparent' });
      const parent = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Parent' }, grandparent);
      const child = await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parent);

      // Only the leaf is secured
      await secureFeature(child);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('leaf-only-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId}
        ORDER BY anchor_submission_feature_id;
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      // Child has no secured ancestors — it IS the anchor
      expect(anchorIds).to.include(child);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor only the mid-level feature when it alone is secured', async () => {
      // Hierarchy: grandparent → parent → child
      // Secured:   NO             YES      NO
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'dataset', { name: 'Grandparent' });
      const parent = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Parent' }, grandparent);
      await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parent);

      // Only the middle level is secured
      await secureFeature(parent);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('mid-only-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId}
        ORDER BY anchor_submission_feature_id;
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      // Parent has no secured ancestors — it IS the anchor
      expect(anchorIds).to.include(parent);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should delete anchors and make features publicly visible when security rules are removed', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Going Public' });
      await secureFeature(featureId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('unsecure-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      expect(await countAnchors(scopeId)).to.be.greaterThan(0);

      // Anonymous cannot see the secured feature
      const beforeAnon = await searchInSubmission(submissionId, ['dataset'], null);
      expect(beforeAnon.map((r) => r.submission_feature_id)).to.not.include(featureId);

      // Remove security + recompute anchors (stale anchor gets cleaned up)
      await unsecureFeature(featureId);
      await scopeRepo.deleteStaleAnchorsForScope(scopeId);
      await computeAnchors(scopeId);

      // Anchor deleted
      const anchorResult = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM security_scope_anchor
        WHERE anchor_submission_feature_id = ${featureId};
      `);
      expect(anchorResult.rows[0].count).to.equal(0);

      // Now anonymous CAN see the feature (no longer secured)
      const afterAnon = await searchInSubmission(submissionId, ['dataset'], null);
      const feature = afterAnon.find((r) => r.submission_feature_id === featureId);
      expect(feature).to.not.be.undefined;
      expect(feature?.is_secured).to.be.false;
    });

    it('should delete anchors only for unsecured features, preserving anchors for still-secured features', async () => {
      // 3 secured features → 3 anchors. Unsecure 2, delete their anchors.
      // The remaining feature's anchor should be untouched.
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Stay Secured' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Going Public 1' });
      const feat3 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Going Public 2' });
      await secureFeature(feat1);
      await secureFeature(feat2);
      await secureFeature(feat3);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('selective-anchor-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      // All 3 features are anchors
      expect(await countAnchors(scopeId)).to.equal(3);

      // Unsecure feat2 and feat3, recompute anchors (stale anchors get cleaned up)
      await unsecureFeature(feat2);
      await unsecureFeature(feat3);
      await scopeRepo.deleteStaleAnchorsForScope(scopeId);
      await computeAnchors(scopeId);

      // feat1's anchor remains, feat2 and feat3 are gone
      expect(await countAnchors(scopeId)).to.equal(1);

      const remaining = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId};
      `);
      expect(remaining.rows[0].anchor_submission_feature_id).to.equal(feat1);
    });
  });

  describe('Upload status → anchor eligibility', () => {
    /**
     * Override the submission_upload_status for a feature's upload.
     * createTestFeature defaults to 'approved'; this lets tests flip to other states.
     */
    async function setUploadStatus(submissionFeatureId: number, status: string): Promise<void> {
      await connection.sql(SQL`
        UPDATE submission_upload_status
        SET status = ${status}::submission_upload_status_type
        WHERE submission_upload_id = (
          SELECT submission_upload_id
          FROM submission_feature
          WHERE submission_feature_id = ${submissionFeatureId}
        );
      `);
    }

    it('should exclude features from denied uploads when computing anchors', async () => {
      const submissionId = await createTestSubmission(connection);
      const dataset = await createTestFeature(connection, submissionId, 'dataset', { name: 'Denied Dataset' });

      await secureFeature(dataset);
      await setUploadStatus(dataset, 'denied');

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('denied-upload-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should exclude features from unreviewed uploads when computing anchors', async () => {
      const submissionId = await createTestSubmission(connection);
      const dataset = await createTestFeature(connection, submissionId, 'dataset', { name: 'Unreviewed Dataset' });

      await secureFeature(dataset);
      await setUploadStatus(dataset, 'submitted');

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('unreviewed-upload-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should include features from approved uploads when computing anchors', async () => {
      const submissionId = await createTestSubmission(connection);
      const dataset = await createTestFeature(connection, submissionId, 'dataset', { name: 'Approved Dataset' });

      await secureFeature(dataset);
      // createTestFeature already sets status = 'approved', no override needed

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('approved-upload-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(1);
    });
  });

  describe('Narrowed URN anchor computation', () => {
    it('should anchor a specific feature by ID even when its ancestor is secured', async () => {
      // Hierarchy: dataset → observation → telemetry
      // Secured:   YES        NO            YES
      // URN:       urn:{submissionId}:*:{telemetryId}  (targets telemetry by ID)
      //
      // Bug: the ancestor walk finds dataset (secured) and excludes telemetry
      // from being an anchor. But the URN explicitly names telemetry — it must
      // be the anchor regardless of what's above it.
      const submissionId = await createTestSubmission(connection);
      const dataset = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset' });
      const observation = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Obs' },
        dataset
      );
      const telemetry = await createTestFeature(connection, submissionId, 'telemetry', { name: 'Telem' }, observation);

      await secureFeature(dataset);
      await secureFeature(telemetry);

      const urn = `urn:${submissionId}:*:${telemetry}`;
      const policyId = await createPolicy('specific-feature-urn-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId};
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      // The URN names this feature directly — it MUST be an anchor
      expect(anchorIds).to.include(telemetry);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor type-scoped features even when a different-type ancestor is secured', async () => {
      // Hierarchy: dataset → observation → telemetry
      // Secured:   YES        YES           YES
      // URN:       urn:{submissionId}:telemetry:*  (targets only telemetry type)
      //
      // Bug: the ancestor walk finds observation (secured) and excludes telemetry.
      // But observation is not a telemetry feature — it shouldn't affect anchoring
      // for a telemetry-scoped URN.
      const submissionId = await createTestSubmission(connection);
      const dataset = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset' });
      const observation = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Obs' },
        dataset
      );
      const telemetry = await createTestFeature(connection, submissionId, 'telemetry', { name: 'Telem' }, observation);

      await secureFeature(dataset);
      await secureFeature(observation);
      await secureFeature(telemetry);

      const urn = `urn:${submissionId}:telemetry:*`;
      const policyId = await createPolicy('type-scoped-urn-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId};
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      // Telemetry is the only candidate for this scope — secured ancestors of
      // different types should not prevent it from being an anchor
      expect(anchorIds).to.include(telemetry);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor a specific feature by ID with wildcard submission', async () => {
      // Hierarchy: dataset → observation → telemetry
      // Secured:   YES        NO            YES
      // URN:       urn:*:*:{telemetryId}  (wildcard submission, targets feature by ID)
      const submissionId = await createTestSubmission(connection);
      const dataset = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset' });
      const observation = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Obs' },
        dataset
      );
      const telemetry = await createTestFeature(connection, submissionId, 'telemetry', { name: 'Telem' }, observation);

      await secureFeature(dataset);
      await secureFeature(telemetry);

      const urn = `urn:*:*:${telemetry}`;
      const policyId = await createPolicy('wildcard-sub-specific-feature-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId};
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      expect(anchorIds).to.include(telemetry);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor all matching features for wildcard-submission type-scoped URN (urn:*:telemetry:*)', async () => {
      // Two submissions, each with a secured telemetry feature.
      // URN: urn:*:telemetry:* — wildcard submission, type = telemetry.
      // Both telemetry features should become anchors (no nesting → no pruning).
      // Note: seed data may contain additional secured telemetry features that also
      // become anchors — assert on inclusion of test features, not exact count.
      const sub1 = await createTestSubmission(connection);
      const telem1 = await createTestFeature(connection, sub1, 'telemetry', { name: 'Telem 1' });
      await secureFeature(telem1);

      const sub2 = await createTestSubmission(connection);
      const telem2 = await createTestFeature(connection, sub2, 'telemetry', { name: 'Telem 2' });
      await secureFeature(telem2);

      // Also create a secured dataset feature — it should NOT match the telemetry scope
      const dataset = await createTestFeature(connection, sub1, 'dataset', { name: 'Dataset' });
      await secureFeature(dataset);

      const urn = 'urn:*:telemetry:*';
      const policyId = await createPolicy('wildcard-sub-type-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId}
        ORDER BY anchor_submission_feature_id;
      `);

      const anchorIds = anchors.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      // Both telemetry features are anchors (cross-submission wildcard match)
      expect(anchorIds).to.include(telem1);
      expect(anchorIds).to.include(telem2);
      // Dataset feature excluded — wrong feature type for this scope
      expect(anchorIds).to.not.include(dataset);
    });
  });

  // ── findScopeIdsMatchingSubmission → URN pattern matching ───────────

  describe('findScopeIdsMatchingSubmission → URN pattern matching', () => {
    // Seed data may include policy_statements with wildcard URNs (urn_submission_id = '*')
    // that match any submission. Tests use a baseline snapshot to isolate assertions
    // to scopes created within the test.

    it('should match a submission-scoped URN (urn:{subId}:*:*)', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy('sub-scope-match');
      const stmtId = await createPolicyStatement(policyId, `urn:${submissionId}:*:*`);
      const scopeId = await setupScopeChain(stmtId, `urn:${submissionId}:*:*`);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length + 1);
    });

    it('should match a wildcard URN (urn:*:*:*) for any submission', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy('wildcard-match');
      const stmtId = await createPolicyStatement(policyId, 'urn:*:*:*');
      const scopeId = await setupScopeChain(stmtId, 'urn:*:*:*');

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length + 1);
    });

    it('should match a type-scoped wildcard URN (urn:*:telemetry:*) for any submission', async () => {
      const submissionId = await createTestSubmission(connection);

      const policyId = await createPolicy('type-wildcard-match');
      const stmtId = await createPolicyStatement(policyId, 'urn:*:telemetry:*');
      const scopeId = await setupScopeChain(stmtId, 'urn:*:telemetry:*');

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      // urn_submission_id = '*' matches any submission
      expect(scopeIds).to.include(scopeId);
    });

    it('should not match a submission-scoped URN for a different submission', async () => {
      const sub1 = await createTestSubmission(connection);
      const sub2 = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(sub2);

      const policyId = await createPolicy('no-match');
      const stmtId = await createPolicyStatement(policyId, `urn:${sub1}:*:*`);
      const scopeId = await setupScopeChain(stmtId, `urn:${sub1}:*:*`);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(sub2);
      const scopeIds = result.map((r) => r.security_scope_id);

      // sub1-scoped scope should NOT appear in sub2's results
      expect(scopeIds).to.not.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length);
    });

    it('should return both specific and wildcard scopes for same submission', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      // Submission-scoped scope
      const policyA = await createPolicy('specific-match');
      const stmtA = await createPolicyStatement(policyA, `urn:${submissionId}:*:*`);
      const scopeIdA = await setupScopeChain(stmtA, `urn:${submissionId}:*:*`);

      // Wildcard scope (different hash → different scope row)
      const policyB = await createPolicy('wildcard-also-match');
      const stmtB = await createPolicyStatement(policyB, 'urn:*:*:*');
      const scopeIdB = await setupScopeChain(stmtB, 'urn:*:*:*');

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.include(scopeIdA);
      expect(scopeIds).to.include(scopeIdB);
      expect(result).to.have.lengthOf(baseline.length + 2);
    });

    it('should not match soft-deleted policy statements', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy('soft-deleted-match');
      const stmtId = await createPolicyStatement(policyId, `urn:${submissionId}:*:*`);
      const scopeId = await setupScopeChain(stmtId, `urn:${submissionId}:*:*`);

      // Soft-delete the statement
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE policy_statement_id = ${stmtId};
      `);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      // Scope exists but its statement is soft-deleted — should not match
      expect(scopeIds).to.not.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length);
    });

    it('should deduplicate when two statements share the same scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const urn = `urn:${submissionId}:*:*`;

      // Two policies with the same URN → same scope (shared by hash)
      const policyA = await createPolicy('dedup-A');
      const stmtA = await createPolicyStatement(policyA, urn);
      const scopeIdA = await setupScopeChain(stmtA, urn);

      const policyB = await createPolicy('dedup-B');
      const stmtB = await createPolicyStatement(policyB, urn);
      const scopeIdB = await setupScopeChain(stmtB, urn);

      // Same scope_hash → same scope row
      expect(scopeIdA).to.equal(scopeIdB);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      // DISTINCT in the query → only 1 new scope despite 2 statements
      expect(result).to.have.lengthOf(baseline.length + 1);
    });
  });

  // ── Keyset pagination → anchor computation correctness ──────────────

  describe('Keyset pagination → anchor computation correctness', () => {
    /**
     * Secure multiple features in bulk using a single INSERT with unnest.
     * More efficient than calling secureFeature() in a loop for large sets.
     */
    async function secureFeaturesInBulk(featureIds: number[]): Promise<void> {
      if (featureIds.length === 0) {
        return;
      }
      const systemUserId = connection.systemUserId();
      await connection.query(
        `INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
         SELECT unnest($1::INTEGER[]), 1, $2`,
        [featureIds, systemUserId]
      );
    }

    it('should promote children to anchors when root is unsecured and scope is recomputed', async () => {
      // Hierarchy: root → childA, root → childB
      // All secured. Root is the only anchor (children pruned by ancestor walk).
      //
      // This is the key scenario that the old deleteAnchorsForFeatures approach
      // could not handle: deleting the root anchor left children orphaned because
      // nothing promoted them. The delete-stale + recompute strategy handles it
      // automatically — the recompute sees children as candidates with no
      // candidate ancestor, so they become anchors.
      const submissionId = await createTestSubmission(connection);
      const root = await createTestFeature(connection, submissionId, 'dataset', { name: 'Root' });
      const childA = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Child A' }, root);
      const childB = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Child B' }, root);

      await secureFeature(root);
      await secureFeature(childA);
      await secureFeature(childB);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('child-promotion-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      // Before: only root is the anchor (children pruned — root is their candidate ancestor)
      const anchorsBefore = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId}
        ORDER BY anchor_submission_feature_id;
      `);
      const anchorIdsBefore = anchorsBefore.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      expect(anchorIdsBefore).to.include(root);
      expect(anchorIdsBefore).to.not.include(childA);
      expect(anchorIdsBefore).to.not.include(childB);
      expect(anchorIdsBefore).to.have.lengthOf(1);

      // Unsecure the root — it no longer meets candidate criteria
      await unsecureFeature(root);

      // Recompute via the service method (first integration test coverage for
      // the service-level orchestration: deleteStaleAnchorsForScope → computeAnchorsForScope)
      await scopeService.computeAnchorsForScope(scopeId);

      // After: root anchor deleted (stale — unsecured), children promoted to anchors
      // (they are now the topmost candidates with no candidate ancestor above them)
      const anchorsAfter = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId}
        ORDER BY anchor_submission_feature_id;
      `);
      const anchorIdsAfter = anchorsAfter.rows.map(
        (r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id
      );
      expect(anchorIdsAfter).to.not.include(root);
      expect(anchorIdsAfter).to.include(childA);
      expect(anchorIdsAfter).to.include(childB);
      expect(anchorIdsAfter).to.have.lengthOf(2);
    });

    it('should process all candidates across multiple keyset batches', async function () {
      // BATCH_SIZE in computeAnchorsForScope is 5000. Creating a root + 5001
      // children exercises both the normal multi-batch path AND the boundary-query
      // fallback:
      //
      // Batch 1 (IDs root..root+4999): root is an anchor (no candidate ancestor),
      //   ~4999 children are pruned (root is their ancestor). result.rows = [root].
      //   lastId advances to max of batch.
      //
      // Batch 2 (IDs root+5000..root+5001): remaining ~2 children, all pruned
      //   (root is their ancestor). result.rows is EMPTY → triggers the boundary-
      //   query fallback to advance lastId without producing anchors.
      //
      // Final state: exactly 1 anchor (the root). If the keyset loop or fallback
      // is broken, candidates are lost or the loop hangs.
      this.timeout(120000);

      const submissionId = await createTestSubmission(connection);
      const root = await createTestFeature(connection, submissionId, 'dataset', { name: 'Root' });

      // Bulk-insert 5001 children under root — enough to span two keyset batches
      const childIds = await createTestFeaturesInBulk(connection, submissionId, 'sample_site', 5001, root);

      // Secure root + all children in bulk
      await secureFeaturesInBulk([root, ...childIds]);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy('multi-batch-test');
      const stmtId = await createPolicyStatement(policyId, urn);
      const scopeId = await setupScopeChain(stmtId, urn);

      // Exactly 1 anchor: the root. All 5001 children are pruned because root
      // is their candidate ancestor. This proves the keyset loop processed all
      // candidates across both batches and the boundary-query fallback advanced
      // the cursor correctly for the all-pruned second batch.
      expect(await countAnchors(scopeId)).to.equal(1);

      const anchors = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId};
      `);
      expect(anchors.rows[0].anchor_submission_feature_id).to.equal(root);
    });
  });
});
