// Integration test for cart submission feature security — verifies the auth-aware walk-up CTE
// correctly gates secured features at insert time, computes the `secured` flag on read,
// and counts all features regardless of security status.
//
// Tests the full SQL execution path: recursive ancestor walk-up, security_scope_anchor →
// team_security_scope → team_member join, and the bulk CTE for read-side `secured` computation.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { CartRepository } from '../../repositories/cart-repository';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { CartSubmissionFeatureService } from '../../services/cart-submission-feature-service';
import { computeScopeHash } from '../../utils/scope-hash';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

describe('Cart submission feature security (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let cartRepo: CartRepository;
  let scopeRepo: SecurityScopeRepository;
  let cartFeatureService: CartSubmissionFeatureService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    cartRepo = new CartRepository(connection);
    scopeRepo = new SecurityScopeRepository(connection);
    cartFeatureService = new CartSubmissionFeatureService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Create an empty active cart and return its cart_id.
   */
  async function createActiveCart(systemUserId: number | null): Promise<string> {
    const cart = await cartRepo.createCart(systemUserId);
    return cart.cart_id;
  }

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

  async function createPolicyStatement(policyId: string, urn: string): Promise<string> {
    const systemUserId = connection.systemUserId();
    const result = await connection.sql(SQL`
      INSERT INTO policy_statement (policy_id, effect, submission_feature_urn, create_user)
      VALUES (${policyId}, 'allow', ${urn}, ${systemUserId})
      RETURNING policy_statement_id;
    `);
    return result.rows[0].policy_statement_id;
  }

  async function createTeamPolicy(teamId: string, policyId: string): Promise<void> {
    const systemUserId = connection.systemUserId();
    await connection.sql(SQL`
      INSERT INTO team_policy (team_id, policy_id, create_user)
      VALUES (${teamId}, ${policyId}, ${systemUserId});
    `);
  }

  /**
   * Compute anchors for a scope using the repository's keyset-paginated API.
   * Bypasses pg-boss — runs synchronously within the test transaction.
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
   * Full RBAC setup: policy → statement → scope chain → team → member → team_policy → team scopes.
   * Returns all created IDs for assertions.
   */
  async function setupFullAccess(
    urn: string,
    userId: number,
    teamName: string
  ): Promise<{ policyId: string; scopeId: string; teamId: string }> {
    const policyId = await createPolicy(`${teamName}-policy`);
    const stmtId = await createPolicyStatement(policyId, urn);
    const scopeId = await setupScopeChain(stmtId, urn);

    const teamId = await createTeam(teamName);
    await addTeamMember(teamId, userId);
    await createTeamPolicy(teamId, policyId);
    await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

    return { policyId, scopeId, teamId };
  }

  let _userSeq = 0;
  /**
   * Create a separate system_user for testing scope access without the API connection user.
   * Note: "system_user" must be quoted — it is a PostgreSQL reserved keyword.
   */
  async function createOtherUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-cart-sec-${Date.now()}-${++_userSeq}`;
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

  /**
   * Get features currently in a cart via raw SQL (bypasses the service under test).
   */
  async function getCartFeatureIds(cartId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT submission_feature_id
      FROM cart_submission_feature
      WHERE cart_id = ${cartId}
      ORDER BY submission_feature_id;
    `);
    return result.rows.map((r: { submission_feature_id: number }) => r.submission_feature_id);
  }

  // ── addSubmissionFeaturesToCart — anonymous ──────────────────────────

  describe('addSubmissionFeaturesToCart — anonymous', () => {
    it('should add an unsecured feature to cart', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Public Dataset' });

      const cartId = await createActiveCart(null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([featureId]);
    });

    it('should exclude a directly secured feature', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Dataset' });
      await secureFeature(featureId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should exclude a feature with inherited security from a secured parent', async () => {
      const submissionId = await createTestSubmission(connection);
      const parentId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Parent' });
      const childId = await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parentId);
      await secureFeature(parentId);

      const cartId = await createActiveCart(null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [childId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });
  });

  // ── addSubmissionFeaturesToCart — authenticated ─────────────────────

  describe('addSubmissionFeaturesToCart — authenticated', () => {
    it('should add a secured feature when user has scope access', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Dataset' });
      await secureFeature(featureId);

      const userId = await createOtherUser();
      await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'scope-access-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], userId);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([featureId]);
    });

    it('should exclude a secured feature when user has NO scope access', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Dataset' });
      await secureFeature(featureId);

      // User exists but is not a member of any team with scope access
      const userId = await createOtherUser();

      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], userId);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });

    it('should add an unsecured feature with secured: false', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Public Dataset' });

      const userId = await createOtherUser();
      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], userId);

      const features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features).to.have.length(1);
      expect(features[0].submission_feature_id).to.equal(featureId);
      expect(features[0].secured).to.equal(false);
    });

    it('should add only authorized features from a mixed batch', async () => {
      const submissionId = await createTestSubmission(connection);

      // Unsecured feature — always allowed
      const unsecuredId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Public' });

      // Directly secured feature — user has scope access
      const securedId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedId);

      // Inherited security — parent secured, child has no direct rule
      const securedParentId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Secured Parent'
      });
      const inheritedChildId = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { name: 'Inherited Child' },
        securedParentId
      );
      await secureFeature(securedParentId);

      // Note: securedId's scope access covers it directly; inheritedChildId's access
      // comes via ancestor walk-up to securedParentId which is also in the same submission

      const userId = await createOtherUser();
      // Grant scope for the first secured feature's submission but NOT the second
      // Use wildcard URN that covers the whole submission — all secured features accessible
      await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'mixed-batch-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(
        cartId,
        [unsecuredId, securedId, inheritedChildId],
        userId
      );

      const ids = await getCartFeatureIds(cartId);
      // All three should be added: unsecured passes through, secured + inherited pass via scope access
      expect(ids).to.include.members([unsecuredId, securedId, inheritedChildId]);
      expect(ids).to.have.length(3);
    });

    it('should add only features from the scoped submission when user has partial authorization across submissions', async () => {
      // Submission A — user has scope access
      const submissionA = await createTestSubmission(connection);
      const securedA = await createTestFeature(connection, submissionA, 'dataset', { name: 'Secured A' });
      await secureFeature(securedA);

      // Submission B — user has NO scope access
      const submissionB = await createTestSubmission(connection);
      const securedB = await createTestFeature(connection, submissionB, 'dataset', { name: 'Secured B' });
      await secureFeature(securedB);

      const userId = await createOtherUser();
      // Grant scope only for submission A
      await setupFullAccess(`urn:${submissionA}:*:*`, userId, 'partial-auth-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [securedA, securedB], userId);

      const ids = await getCartFeatureIds(cartId);
      // Only the feature from the scoped submission should be added
      expect(ids).to.deep.equal([securedA]);
    });
  });

  // ── getCartSubmissionFeatures — secured flag ───────────────────────

  describe('getCartSubmissionFeatures — secured flag', () => {
    it('should return secured: true for secured features and secured: false for unsecured', async () => {
      const submissionId = await createTestSubmission(connection);
      const unsecuredId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Public' });
      const securedId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedId);

      const userId = await createOtherUser();
      await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'secured-flag-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [unsecuredId, securedId], userId);

      const features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features).to.have.length(2);

      const unsecuredFeature = features.find((f) => f.submission_feature_id === unsecuredId);
      const securedFeature = features.find((f) => f.submission_feature_id === securedId);

      expect(unsecuredFeature?.secured).to.equal(false);
      expect(securedFeature?.secured).to.equal(true);
    });

    it('should reflect security changes after feature was added to cart', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Initially Public' });

      // Add while unsecured (anonymous can add it)
      const cartId = await createActiveCart(null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], null);

      // Verify initially unsecured
      let features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features[0].secured).to.equal(false);

      // Apply security after the feature is already in the cart
      await secureFeature(featureId);

      // Read-side CTE should now compute secured: true
      features = await cartFeatureService.getCartSubmissionFeatures(cartId);
      expect(features[0].secured).to.equal(true);
    });

    it('should filter by submissionFeatureId when provided', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureA = await createTestFeature(connection, submissionId, 'dataset', { name: 'A' });
      const featureB = await createTestFeature(connection, submissionId, 'dataset', { name: 'B' });

      const cartId = await createActiveCart(null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureA, featureB], null);

      const filtered = await cartFeatureService.getCartSubmissionFeatures(cartId, undefined, featureA);
      expect(filtered).to.have.length(1);
      expect(filtered[0].submission_feature_id).to.equal(featureA);
    });
  });

  // ── getCartSubmissionFeatureCount ──────────────────────────────────

  describe('getCartSubmissionFeatureCount', () => {
    it('should count all features including secured ones', async () => {
      const submissionId = await createTestSubmission(connection);
      const unsecuredId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Public' });
      const securedId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedId);

      const userId = await createOtherUser();
      await setupFullAccess(`urn:${submissionId}:*:*`, userId, 'count-team');

      const cartId = await createActiveCart(userId);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [unsecuredId, securedId], userId);

      const count = await cartFeatureService.getCartSubmissionFeatureCount(cartId);
      expect(count).to.equal(2);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle idempotent add (same feature twice) without error', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset' });

      const cartId = await createActiveCart(null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], null);
      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([featureId]);
    });

    it('should not add features to an inactive (checked-out) cart', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset' });

      const cartId = await createActiveCart(null);

      // Mark the cart as checked_out
      await connection.sql(SQL`
        UPDATE cart SET cart_status = 'checked_out' WHERE cart_id = ${cartId};
      `);

      await cartFeatureService.addSubmissionFeaturesToCart(cartId, [featureId], null);

      const ids = await getCartFeatureIds(cartId);
      expect(ids).to.deep.equal([]);
    });
  });
});
