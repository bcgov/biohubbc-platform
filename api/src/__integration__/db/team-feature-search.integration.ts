// Integration test for team_feature cache population and search filtering —
// verifies that TeamFeatureService correctly resolves URN wildcards into cached
// team_feature rows, and that SearchFeatureService respects those cache entries
// when filtering secured features by authenticated user.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { PolicyEffect } from '../../models/policy-statement';
import { PolicyService } from '../../services/access-policy/policy-service';
import { TeamFeatureService } from '../../services/access-policy/team-feature-service';
import { TeamPolicyService } from '../../services/access-policy/team-policy-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { ISearchFeaturesFilters } from '../../services/search-feature-service.interface';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

describe('Team feature cache + search (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ────────────────────────────────────────────────────────────

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
   * Create a team and return its UUID.
   */
  async function createTeam(name: string): Promise<string> {
    const systemUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO team (name, create_user)
      VALUES (${name}, ${systemUserId})
      RETURNING team_id;
    `);

    return result.rows[0].team_id;
  }

  /**
   * Create a system_user and return its system_user_id.
   */
  let _userSeq = 0;
  async function createUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-tf-${Date.now()}-${++_userSeq}`;

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
   * Add a user to a team.
   */
  async function addTeamMember(teamId: string, userId: number): Promise<void> {
    const apiUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO team_member (system_user_id, team_id, create_user)
      VALUES (${userId}, ${teamId}, ${apiUserId});
    `);
  }

  /**
   * Create a policy with a single ALLOW statement for the given URN,
   * assign it to a team via team_policy.
   * The policy_statement trigger auto-decomposes the URN into indexed columns.
   */
  async function grantTeamAccess(teamId: string, urn: string): Promise<{ policyId: string }> {
    const userId = connection.systemUserId();

    const policy = await connection.sql(SQL`
      INSERT INTO policy (name, create_user)
      VALUES (${`test-policy-${Date.now()}-${++_userSeq}`}, ${userId})
      RETURNING policy_id;
    `);
    const policyId = policy.rows[0].policy_id;

    await connection.sql(SQL`
      INSERT INTO policy_statement (policy_id, effect, submission_feature_urn, create_user)
      VALUES (${policyId}, 'allow', ${urn}, ${userId});
    `);

    await connection.sql(SQL`
      INSERT INTO team_policy (team_id, policy_id, create_user)
      VALUES (${teamId}, ${policyId}, ${userId});
    `);

    return { policyId };
  }

  /**
   * Get all submission_feature_ids cached in team_feature for a given team.
   */
  async function getTeamFeatureIds(teamId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT submission_feature_id FROM team_feature
      WHERE team_id = ${teamId}
      ORDER BY submission_feature_id;
    `);

    return result.rows.map((r: { submission_feature_id: number }) => r.submission_feature_id);
  }

  // ── Cache population tests ─────────────────────────────────────────────

  describe('TeamFeatureService cache refresh', () => {
    it('should populate team_feature for exact URN match', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Dataset' });
      await secureFeature(featureId);

      const teamId = await createTeam('Exact URN Team');
      await grantTeamAccess(teamId, `urn:${submissionId}:dataset:${featureId}`);

      const service = new TeamFeatureService(connection);
      await service.refreshCacheForTeam(teamId);

      const cached = await getTeamFeatureIds(teamId);
      expect(cached).to.deep.equal([featureId]);
    });

    it('should populate team_feature for wildcard URN (urn:*:*:*)', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset A' });
      const featureId2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset B' });
      await secureFeature(featureId1);
      await secureFeature(featureId2);

      const teamId = await createTeam('Wildcard URN Team');
      await grantTeamAccess(teamId, 'urn:*:*:*');

      const service = new TeamFeatureService(connection);
      await service.refreshCacheForTeam(teamId);

      const cached = await getTeamFeatureIds(teamId);
      expect(cached).to.include(featureId1);
      expect(cached).to.include(featureId2);
    });

    it('should only cache secured features, not unsecured', async () => {
      const submissionId = await createTestSubmission(connection);
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      const unsecuredFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      await secureFeature(securedFeatureId);
      // unsecuredFeatureId is NOT secured

      const teamId = await createTeam('Mixed Features Team');
      await grantTeamAccess(teamId, 'urn:*:*:*');

      const service = new TeamFeatureService(connection);
      await service.refreshCacheForTeam(teamId);

      const cached = await getTeamFeatureIds(teamId);
      expect(cached).to.include(securedFeatureId);
      expect(cached).to.not.include(unsecuredFeatureId);
    });

    it('should clear stale entries and repopulate on re-refresh', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Feature 1' });
      const featureId2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Feature 2' });
      await secureFeature(featureId1);
      await secureFeature(featureId2);

      const teamId = await createTeam('Refresh Team');

      // Grant access to feature 1 only (exact URN)
      await grantTeamAccess(teamId, `urn:${submissionId}:dataset:${featureId1}`);

      const service = new TeamFeatureService(connection);
      await service.refreshCacheForTeam(teamId);

      expect(await getTeamFeatureIds(teamId)).to.deep.equal([featureId1]);

      // Now add a second policy granting access to feature 2
      await grantTeamAccess(teamId, `urn:${submissionId}:dataset:${featureId2}`);
      await service.refreshCacheForTeam(teamId);

      const cached = await getTeamFeatureIds(teamId);
      expect(cached).to.include(featureId1);
      expect(cached).to.include(featureId2);
      expect(cached).to.have.length(2);
    });
  });

  // ── Mutation hook tests ──────────────────────────────────────────────────
  //
  // Verifies that creating/deleting policies and team-policy associations
  // through the service layer automatically refreshes the team_feature cache.

  describe('Cache refresh via service-layer mutations', () => {
    it('should populate cache when creating a policy with statements via PolicyService', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Policy Create Test' });
      await secureFeature(featureId);

      const teamId = await createTeam('Policy Create Team');

      // Create policy via service — triggers refreshCacheForPolicy
      const policyService = new PolicyService(connection);
      const policy = await policyService.createPolicyWithStatements({ name: `test-policy-create-${Date.now()}` }, [
        { effect: PolicyEffect.ALLOW, submission_feature_urn: `urn:${submissionId}:dataset:${featureId}` }
      ]);

      // Assign policy to team via service — triggers refreshCacheForTeam
      const teamPolicyService = new TeamPolicyService(connection);
      await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policy.policy_id });

      const cached = await getTeamFeatureIds(teamId);
      expect(cached).to.deep.equal([featureId]);
    });

    it('should update cache when policy statements are updated via PolicyService', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Feature A' });
      const featureId2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Feature B' });
      await secureFeature(featureId1);
      await secureFeature(featureId2);

      const teamId = await createTeam('Policy Update Team');

      // Create policy granting access to feature 1 only
      const policyService = new PolicyService(connection);
      const policy = await policyService.createPolicyWithStatements({ name: `test-policy-update-${Date.now()}` }, [
        { effect: PolicyEffect.ALLOW, submission_feature_urn: `urn:${submissionId}:dataset:${featureId1}` }
      ]);

      const teamPolicyService = new TeamPolicyService(connection);
      await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policy.policy_id });

      expect(await getTeamFeatureIds(teamId)).to.deep.equal([featureId1]);

      // Update policy to grant access to feature 2 instead — triggers cache refresh
      await policyService.updatePolicyWithStatements(policy.policy_id, { name: policy.name }, [
        { effect: PolicyEffect.ALLOW, submission_feature_urn: `urn:${submissionId}:dataset:${featureId2}` }
      ]);

      const cached = await getTeamFeatureIds(teamId);
      expect(cached).to.deep.equal([featureId2]);
    });

    it('should clear cache when policy is deleted via PolicyService', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Policy Delete Test' });
      await secureFeature(featureId);

      const teamId = await createTeam('Policy Delete Team');

      const policyService = new PolicyService(connection);
      const policy = await policyService.createPolicyWithStatements({ name: `test-policy-delete-${Date.now()}` }, [
        { effect: PolicyEffect.ALLOW, submission_feature_urn: `urn:${submissionId}:dataset:${featureId}` }
      ]);

      const teamPolicyService = new TeamPolicyService(connection);
      await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policy.policy_id });

      expect(await getTeamFeatureIds(teamId)).to.deep.equal([featureId]);

      // Delete policy — triggers cache refresh for affected teams
      await policyService.deletePolicy(policy.policy_id);

      expect(await getTeamFeatureIds(teamId)).to.deep.equal([]);
    });

    it('should clear cache when team-policy is deleted via TeamPolicyService', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'TP Delete Test' });
      await secureFeature(featureId);

      const teamId = await createTeam('TP Delete Team');

      const policyService = new PolicyService(connection);
      const policy = await policyService.createPolicyWithStatements({ name: `test-tp-delete-${Date.now()}` }, [
        { effect: PolicyEffect.ALLOW, submission_feature_urn: `urn:${submissionId}:dataset:${featureId}` }
      ]);

      const teamPolicyService = new TeamPolicyService(connection);
      const teamPolicy = await teamPolicyService.createTeamPolicy({
        team_id: teamId,
        policy_id: policy.policy_id
      });

      expect(await getTeamFeatureIds(teamId)).to.deep.equal([featureId]);

      // Delete team-policy — triggers cache refresh for the team
      await teamPolicyService.deleteTeamPolicy(teamPolicy.team_policy_id);

      expect(await getTeamFeatureIds(teamId)).to.deep.equal([]);
    });
  });

  // ── Inherited security tests ─────────────────────────────────────────────
  //
  // Validates the `secured_features` recursive CTE: a child feature inherits
  // is_secured from its parent, and unrelated features are NOT marked secured.

  describe('secured_features CTE — inherited security', () => {
    it('should mark child as secured when parent has a security rule', async () => {
      const submissionId = await createTestSubmission(connection);

      // Parent dataset — secured
      const parentId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured Parent' });
      await secureFeature(parentId);

      // Child sample_site — NOT directly secured, but inherits from parent
      const childId = await createTestFeature(
        connection,
        submissionId,
        'sample_site',
        { name: 'Child Site' },
        parentId
      );

      // Unrelated unsecured feature in the same submission
      const unrelatedId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open Dataset' });

      const searchService = new SearchFeatureService(connection);
      const filters: ISearchFeaturesFilters = { feature_types: ['dataset', 'sample_site'] };

      // Search without security filtering (no systemUserId) to see raw is_secured flags
      const features = await searchService.searchFeatures(filters);

      const child = features.find((f) => f.submission_feature_id === childId);
      const parent = features.find((f) => f.submission_feature_id === parentId);
      const unrelated = features.find((f) => f.submission_feature_id === unrelatedId);

      // Parent is directly secured
      expect(parent, 'parent should be in results').to.exist;
      expect(parent!.is_secured, 'parent should be secured').to.equal(true);

      // Child inherits security from parent via recursive CTE
      expect(child, 'child should be in results').to.exist;
      expect(child!.is_secured, 'child should inherit secured from parent').to.equal(true);

      // Unrelated feature must NOT be marked secured (per-row, not global)
      expect(unrelated, 'unrelated should be in results').to.exist;
      expect(unrelated!.is_secured, 'unrelated should NOT be secured').to.equal(false);
    });

    it('should mark deeply nested grandchild as secured', async () => {
      const submissionId = await createTestSubmission(connection);

      // Grandparent dataset — secured
      const grandparentId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Secured Grandparent'
      });
      await secureFeature(grandparentId);

      // Parent sample_site — child of grandparent
      const parentId = await createTestFeature(
        connection,
        submissionId,
        'sample_site',
        { name: 'Middle Parent' },
        grandparentId
      );

      // Grandchild telemetry — child of parent
      const grandchildId = await createTestFeature(
        connection,
        submissionId,
        'telemetry',
        { name: 'Deep Grandchild' },
        parentId
      );

      const searchService = new SearchFeatureService(connection);
      const filters: ISearchFeaturesFilters = { feature_types: ['dataset', 'sample_site', 'telemetry'] };

      const features = await searchService.searchFeatures(filters);

      const grandchild = features.find((f) => f.submission_feature_id === grandchildId);
      expect(grandchild, 'grandchild should be in results').to.exist;
      expect(grandchild!.is_secured, 'grandchild should inherit secured from grandparent').to.equal(true);
    });
  });

  // ── Search filtering tests ─────────────────────────────────────────────

  describe('Search with team_feature filtering', () => {
    /**
     * Shared setup: creates a submission with one unsecured and one secured feature,
     * a team with a user, and a policy granting the team access to the secured feature.
     * Returns all IDs needed for assertions.
     */
    async function setupSearchScenario() {
      const submissionId = await createTestSubmission(connection);
      const unsecuredFeatureId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Open Dataset'
      });
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Secured Dataset'
      });
      await secureFeature(securedFeatureId);

      const teamId = await createTeam('Search Test Team');
      const userId = await createUser();
      await addTeamMember(teamId, userId);

      // Grant team access to the secured feature and populate cache
      await grantTeamAccess(teamId, `urn:${submissionId}:dataset:${securedFeatureId}`);
      const teamFeatureService = new TeamFeatureService(connection);
      await teamFeatureService.refreshCacheForTeam(teamId);

      return { submissionId, unsecuredFeatureId, securedFeatureId, teamId, userId };
    }

    it('should return only unsecured features for anonymous search (systemUserId=null)', async () => {
      const { unsecuredFeatureId, securedFeatureId } = await setupSearchScenario();

      const searchService = new SearchFeatureService(connection);
      const filters: ISearchFeaturesFilters = { feature_types: ['dataset'] };

      const features = await searchService.searchFeatures(filters, undefined, null);
      const featureIds = features.map((f) => f.submission_feature_id);

      expect(featureIds).to.include(unsecuredFeatureId);
      expect(featureIds).to.not.include(securedFeatureId);
    });

    it('should return unsecured + authorized secured features for authenticated user', async () => {
      const { unsecuredFeatureId, securedFeatureId, userId } = await setupSearchScenario();

      const searchService = new SearchFeatureService(connection);
      const filters: ISearchFeaturesFilters = { feature_types: ['dataset'] };

      const features = await searchService.searchFeatures(filters, undefined, userId);
      const featureIds = features.map((f) => f.submission_feature_id);

      expect(featureIds).to.include(unsecuredFeatureId);
      expect(featureIds).to.include(securedFeatureId);
    });

    it('should return only unsecured features for authenticated user without policies', async () => {
      const { unsecuredFeatureId, securedFeatureId } = await setupSearchScenario();

      // Create a user who is NOT in any team with policies
      const unaffiliatedUserId = await createUser();

      const searchService = new SearchFeatureService(connection);
      const filters: ISearchFeaturesFilters = { feature_types: ['dataset'] };

      const features = await searchService.searchFeatures(filters, undefined, unaffiliatedUserId);
      const featureIds = features.map((f) => f.submission_feature_id);

      expect(featureIds).to.include(unsecuredFeatureId);
      expect(featureIds).to.not.include(securedFeatureId);
    });

    it('should include count that reflects security filtering', async () => {
      const { userId } = await setupSearchScenario();

      const searchService = new SearchFeatureService(connection);
      const filters: ISearchFeaturesFilters = { feature_types: ['dataset'] };

      // Anonymous count should be less than authenticated count (secured feature excluded)
      const anonCount = await searchService.getSearchFeaturesCount(filters, null);
      const authCount = await searchService.getSearchFeaturesCount(filters, userId);

      expect(authCount).to.be.greaterThan(anonCount);
    });
  });
});
