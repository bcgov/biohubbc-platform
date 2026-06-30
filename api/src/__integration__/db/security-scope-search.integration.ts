// Integration test for security scope pipeline — verifies scope creation, anchor computation,
// team scope grants, anchor reuse, and search access filtering against the real database.
//
// Tests use repository methods directly for scope setup. Service methods that internally
// publish pg-boss jobs (e.g. materializePolicyStatementScopes → publishComputeScopeAnchorsJob)
// are called directly, but the publisher is stubbed in beforeEach because pg-boss is not
// running in the make test-db environment. Anchor recomputation is simulated by calling
// the phase methods (deleteStaleAnchorBatch / computeAnchorBatch) directly via
// refreshAnchorsViaService.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SecurityScopeRepository } from '../../repositories/authorization/security-scope-repository';
import { SearchFeatureRepository } from '../../repositories/search-feature-repository';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { SubmissionFeatureClosureService } from '../../services/submission-feature-closure-service';
import { computeScopeHash } from '../../utils/scope-hash';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import {
  addTeamMember,
  computeAnchors,
  createPolicy,
  createPolicyStatement,
  createTeam,
  createTeamPolicy,
  secureFeature,
  setupFullAccess,
  setupScopeChain
} from '../helpers/test-rbac-helpers';
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

    // pg-boss is not running in the make test-db environment; stub the publisher so
    // service methods that enqueue anchor-computation jobs can proceed. Anchor recomputation
    // is simulated by calling phase methods directly via refreshAnchorsViaService.
    sinon
      .stub(SecurityScopeService.dependencies, 'publishComputeScopeAnchorsJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
    sinon.restore();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  async function markFeatureFutureDate(submissionFeatureId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature
      SET record_effective_date = now() + INTERVAL '7 days'
      WHERE submission_feature_id = ${submissionFeatureId};
    `);
  }

  async function markFeatureUnapproved(submissionFeatureId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature
      SET record_effective_date = NULL
      WHERE submission_feature_id = ${submissionFeatureId};
    `);
  }

  async function unsecureFeature(submissionFeatureId: number): Promise<void> {
    await connection.sql(SQL`
      UPDATE submission_feature_security
      SET record_end_date = now()
      WHERE submission_feature_id = ${submissionFeatureId}
        AND record_end_date IS NULL;
    `);
  }

  /**
   * Insert ONE submission_feature bound to a SPECIFIC upload, resolving feature_type_id by name.
   *
   * Read-path security is now resolved via the precomputed `submission_feature_closure`, which is
   * UPLOAD-SCOPED and only links a parent and child when both share one submission_upload_id (both
   * endpoints must be active features of the same upload). `createTestFeature` mints its OWN upload
   * per call and cannot place a parent + child under one upload, so the closure-driven search-security
   * fixtures insert features directly here under a shared upload. Mirrors the insertFeatureRow helper in
   * expression-evaluation.integration.ts.
   *
   * @returns The new submission_feature_id.
   */
  async function insertFeatureRow(params: {
    submissionId: number;
    submissionUploadId: string;
    featureTypeName: string;
    parentFeatureId?: number;
  }): Promise<number> {
    const systemUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        feature_type_id,
        parent_submission_feature_id,
        data,
        data_byte_size,
        record_effective_date,
        create_user
      )
      VALUES (
        ${params.submissionId},
        ${params.submissionUploadId}::uuid,
        (SELECT feature_type_id FROM feature_type WHERE name = ${params.featureTypeName} LIMIT 1),
        ${params.parentFeatureId ?? null},
        '{}'::jsonb,
        500,
        now(),
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Recompute the upload-scoped closure (self-loops + parent ancestry + property edges) for the given
   * upload. Read-path search security (isEffectivelySecured / isAccessibleToUser) reads this
   * closure, so it MUST be rebuilt AFTER seeding + securing and BEFORE the first search — otherwise the
   * fragment finds nothing and every feature reads as unsecured.
   */
  async function rebuildClosure(uploadId: string): Promise<void> {
    await new SubmissionFeatureClosureService(connection).computeClosureForUpload(uploadId);
  }

  /**
   * Rebuild the closure for every upload that holds an active feature of the submission.
   *
   * The anchor-recompute write path now reads `isEffectivelySecured`, so a feature only reads
   * as effectively secured when its closure rows exist. `createTestFeature` / `createTestFeaturesInBulk`
   * mint a fresh upload per call (or per bulk batch), so directly-secured features each need their own
   * upload's self-loop rebuilt. Cross-feature ancestry is still resolved by the recompute's live
   * `ancestor_walk` over parent pointers, so per-upload self-loops are sufficient whenever the secured
   * feature is secured directly. Tests that depend on a feature inheriting security from an ancestor must
   * instead co-locate the hierarchy under ONE upload (createTestUpload + insertFeatureRow) so the closure
   * stores the ancestry edge.
   */
  async function rebuildClosureForSubmission(submissionId: number): Promise<void> {
    const uploads = await connection.sql(SQL`
      SELECT DISTINCT submission_upload_id
      FROM submission_feature
      WHERE submission_id = ${submissionId}
        AND record_end_date IS NULL;
    `);
    for (const row of uploads.rows) {
      await rebuildClosure(row.submission_upload_id);
    }
  }

  async function countAnchors(securityScopeId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT count(*)::integer as count FROM security_scope_anchor
      WHERE security_scope_id = ${securityScopeId};
    `);
    return result.rows[0].count;
  }

  /**
   * Create a submission with a single secured feature and a scope chain for it.
   * Covers the common "one feature, one policy, one scope" setup pattern.
   *
   * The feature is seeded under a shared upload and the closure is rebuilt so both the read path
   * (searchInSubmission) and the anchor-recompute write path resolve the feature's "directly secured"
   * check via its closure self-loop — both now read `isEffectivelySecured`.
   */
  async function setupSecuredScope(
    _featureName: string,
    policyName: string
  ): Promise<{ submissionId: number; featureId: number; scopeId: string; policyId: string; stmtId: string }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const featureId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'survey'
    });
    await secureFeature(connection, featureId);

    await rebuildClosure(uploadId);

    const urn = `urn:${submissionId}:*:*`;
    const policyId = await createPolicy(connection, policyName);
    const stmtId = await createPolicyStatement(connection, policyId, urn);
    const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

    return { submissionId, featureId, scopeId, policyId, stmtId };
  }

  /**
   * Create a secured survey with a child feature that inherits security,
   * then wire a type-scoped URN and scope chain. Covers the common
   * "parent secured, child inherits, URN targets child type" pattern.
   */
  async function setupInheritedSecurityScope(
    childType: string,
    policyName: string,
    urnOverride?: (submissionId: number, childId: number) => string
  ): Promise<{ submissionId: number; surveyId: number; childId: number; scopeId: string; policyId: string }> {
    const submissionId = await createTestSubmission(connection);
    // Parent + child must share ONE upload so the closure stores the child -> survey ancestor edge;
    // securing the survey then makes the child read as effectively secured (inherited) on the read path.
    const uploadId = await createTestUpload(connection, submissionId);
    const surveyId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'survey'
    });
    const childId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: childType,
      parentFeatureId: surveyId
    });

    await secureFeature(connection, surveyId);

    await rebuildClosure(uploadId);

    const urn = urnOverride ? urnOverride(submissionId, childId) : `urn:${submissionId}:${childType}:*`;
    const policyId = await createPolicy(connection, policyName);
    const stmtId = await createPolicyStatement(connection, policyId, urn);
    const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

    return { submissionId, surveyId, childId, scopeId, policyId };
  }

  /**
   * Seed one secured `survey` feature under its own shared upload, closure rebuilt — the common
   * "one submission, one secured feature, ready for a scope chain or search" fixture.
   */
  async function seedSecuredSurvey(): Promise<{ submissionId: number; uploadId: string; featureId: number }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const featureId = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'survey'
    });
    await secureFeature(connection, featureId);
    await rebuildClosure(uploadId);
    return { submissionId, uploadId, featureId };
  }

  /**
   * Seed a 3-level hierarchy (survey → sample_site → species_observation) under ONE upload with only the
   * grandparent (survey) secured, closure rebuilt. Descendants inherit security via the closure ancestry.
   */
  async function seedSecuredGrandparentHierarchy(): Promise<{
    submissionId: number;
    grandparent: number;
    parent: number;
    child: number;
  }> {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUpload(connection, submissionId);
    const grandparent = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'survey'
    });
    const parent = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'sample_site',
      parentFeatureId: grandparent
    });
    const child = await insertFeatureRow({
      submissionId,
      submissionUploadId: uploadId,
      featureTypeName: 'species_observation',
      parentFeatureId: parent
    });
    await secureFeature(connection, grandparent);
    await rebuildClosure(uploadId);
    return { submissionId, grandparent, parent, child };
  }

  /**
   * Query anchor feature IDs for a scope.
   */
  async function getAnchorIds(scopeId: string): Promise<number[]> {
    const anchors = await connection.sql(SQL`
      SELECT anchor_submission_feature_id FROM security_scope_anchor
      WHERE security_scope_id = ${scopeId};
    `);
    return anchors.rows.map((r: { anchor_submission_feature_id: number }) => r.anchor_submission_feature_id);
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
    const all: { submission_id: number; submission_feature_id: number; is_secured: boolean }[] = [];
    for (const featureType of featureTypes) {
      const results = await searchRepo.searchFeaturesByExpressionTree(featureType, undefined, undefined, systemUserId);
      all.push(...results);
    }
    return all
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

  /**
   * Soft-delete a policy statement (sets record_end_date = now()).
   */
  async function softDeleteStatement(policyStatementId: string): Promise<void> {
    await connection.sql(SQL`
      UPDATE policy_statement SET record_end_date = now()
      WHERE policy_statement_id = ${policyStatementId};
    `);
  }

  /**
   * Soft-delete a team policy (sets record_end_date = now()).
   */
  async function softDeleteTeamPolicy(teamPolicyId: string): Promise<void> {
    await connection.sql(SQL`
      UPDATE team_policy SET record_end_date = now()
      WHERE team_policy_id = ${teamPolicyId};
    `);
  }

  /**
   * Run the paginated stale-anchor-delete loop for a scope (repo-level).
   */
  async function deleteStaleAnchors(scopeId: string): Promise<void> {
    let lastId = 0;
    while (true) {
      const batch = await scopeRepo.deleteStaleAnchorBatch(scopeId, lastId);
      if (!batch) {
        break;
      }
      lastId = batch.pageLastId;
    }
  }

  /**
   * Run the paginated stale-anchor-delete loop for a scope (service-level).
   * pg-boss is not running in the make test-db environment, so this
   * invokes the service phase methods directly.
   */
  async function deleteStaleAnchorsViaService(scopeId: string): Promise<void> {
    let lastId = 0;
    while (true) {
      const batch = await scopeService.deleteStaleAnchorBatch(scopeId, lastId);
      if (!batch) {
        break;
      }
      lastId = batch.pageLastId;
    }
  }

  /**
   * Simulate the pg-boss anchor-refresh job (service-level):
   * delete stale anchors → resolve URN → recompute new anchors.
   */
  async function refreshAnchorsViaService(scopeId: string): Promise<void> {
    await deleteStaleAnchorsViaService(scopeId);
    const urn = await scopeService.resolveUrnForScope(scopeId);
    if (urn) {
      let lastId = 0;
      while (true) {
        const batch = await scopeService.computeAnchorBatch(scopeId, urn, lastId);
        if (!batch) {
          break;
        }
        lastId = batch.pageLastId;
      }
    }
  }

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

  /**
   * Create a secured feature, optionally mark it as not-yet-approved, then compute anchors.
   */
  async function setupApprovalTest(
    featureName: string,
    policyName: string,
    options?: { approved: boolean }
  ): Promise<string> {
    const submissionId = await createTestSubmission(connection);
    const survey = await createTestFeature(connection, submissionId, 'survey', { name: featureName });

    await secureFeature(connection, survey);
    if (options?.approved === false) {
      await markFeatureUnapproved(survey);
    }

    await rebuildClosureForSubmission(submissionId);

    const urn = `urn:${submissionId}:*:*`;
    const policyId = await createPolicy(connection, policyName);
    const stmtId = await createPolicyStatement(connection, policyId, urn);
    return setupScopeChain(scopeRepo, stmtId, urn);
  }

  /**
   * Create a 3-level hierarchy (survey → observation → telemetry), secure
   * the specified features, wire a scope chain, and return all IDs.
   */
  async function setupDeepHierarchyScope(
    securedFeatures: ('survey' | 'observation' | 'telemetry')[],
    urn: (ids: { submissionId: number; survey: number; observation: number; telemetry: number }) => string,
    policyName: string
  ) {
    const submissionId = await createTestSubmission(connection);
    const survey = await createTestFeature(connection, submissionId, 'survey', { name: 'Survey' });
    const observation = await createTestFeature(
      connection,
      submissionId,
      'species_observation',
      { name: 'Obs' },
      survey
    );
    const telemetry = await createTestFeature(connection, submissionId, 'telemetry', { name: 'Telem' }, observation);

    const ids = { submissionId, survey, observation, telemetry };
    const featureMap = { survey, observation, telemetry };
    for (const f of securedFeatures) {
      await secureFeature(connection, featureMap[f]);
    }

    await rebuildClosureForSubmission(submissionId);

    const urnStr = urn(ids);
    const policyId = await createPolicy(connection, policyName);
    const stmtId = await createPolicyStatement(connection, policyId, urnStr);
    const scopeId = await setupScopeChain(scopeRepo, stmtId, urnStr);

    return { ...ids, scopeId };
  }

  // ── Policy create → scope creation ───────────────────────────────────

  describe('Policy create → scope creation', () => {
    it('should create security_scope and attach it to the policy statement', async () => {
      const policyId = await createPolicy(connection, 'scope-creation-test');
      const stmtId = await createPolicyStatement(connection, policyId, 'urn:1:survey:*');

      const scopeId = await setupScopeChain(scopeRepo, stmtId, 'urn:1:survey:*');

      // Verify scope exists with correct hash
      const scope = await scopeRepo.getSecurityScopeByScopeHash(computeScopeHash('urn:1:survey:*'));
      expect(scope.security_scope_id).to.equal(scopeId);

      // Verify policy_statement.security_scope_id mapping
      const statementScopeResult = await connection.sql(SQL`
        SELECT count(*)::integer as count
        FROM policy_statement
        WHERE policy_statement_id = ${stmtId}
          AND security_scope_id = ${scopeId};
      `);
      expect(statementScopeResult.rows[0].count).to.equal(1);
    });

    it('should reuse the same scope for two policies with the same URN (dedup)', async () => {
      const urn = 'urn:1:telemetry:*';

      const policyA = await createPolicy(connection, 'dedup-A');
      const stmtA = await createPolicyStatement(connection, policyA, urn);
      const scopeIdA = await setupScopeChain(scopeRepo, stmtA, urn);

      const policyB = await createPolicy(connection, 'dedup-B');
      const stmtB = await createPolicyStatement(connection, policyB, urn);
      const scopeIdB = await setupScopeChain(scopeRepo, stmtB, urn);

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
      const featureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Anchor Target' });
      await secureFeature(connection, featureId);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:survey:*`;
      const policyId = await createPolicy(connection, 'anchor-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      // Verify the specific feature is an anchor
      const result = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId} AND anchor_submission_feature_id = ${featureId};
      `);
      expect(result.rows[0].count).to.equal(1);
    });

    it('should compute zero anchors when no matching secured features exist', async () => {
      const submissionId = await createTestSubmission(connection);
      await createTestFeature(connection, submissionId, 'survey', { name: 'Unsecured' });
      // Build the self-loop so the unsecured feature reads as effectively unsecured rather than
      // hidden-by-default — isEffectivelySecured fails closed when a feature has no closure rows.
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:survey:*`;
      const policyId = await createPolicy(connection, 'no-anchor-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(0);
    });
  });

  // ── Team-policy create → team scope grants ───────────────────────────

  describe('Team-policy create → team scope grants', () => {
    it('should create team_security_scope rows when team-policy is assigned', async () => {
      const policyId = await createPolicy(connection, 'team-grant-test');
      const stmtId = await createPolicyStatement(connection, policyId, 'urn:*:*:*');
      await setupScopeChain(scopeRepo, stmtId, 'urn:*:*:*');

      const teamId = await createTeam(connection, 'Grant Test Team');
      await createTeamPolicy(connection, teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      expect(await countTeamScopes(teamId)).to.equal(1);
    });

    it('should grant the same scope_id to two teams with the same policy', async () => {
      const policyId = await createPolicy(connection, 'shared-policy');
      const stmtId = await createPolicyStatement(connection, policyId, 'urn:*:telemetry:*');
      await setupScopeChain(scopeRepo, stmtId, 'urn:*:telemetry:*');

      const teamA = await createTeam(connection, 'Team A');
      await createTeamPolicy(connection, teamA, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamA, policyId);

      const teamB = await createTeam(connection, 'Team B');
      await createTeamPolicy(connection, teamB, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamB, policyId);

      const scopeIdsA = await getTeamScopeIds(teamA);
      const scopeIdsB = await getTeamScopeIds(teamB);
      expect(scopeIdsA).to.deep.equal(scopeIdsB);
    });

    it('should accumulate scopes when a second policy is assigned to the same team', async () => {
      const policyA = await createPolicy(connection, 'multi-policy-A');
      const stmtA = await createPolicyStatement(connection, policyA, 'urn:1:survey:*');
      await setupScopeChain(scopeRepo, stmtA, 'urn:1:survey:*');

      const policyB = await createPolicy(connection, 'multi-policy-B');
      const stmtB = await createPolicyStatement(connection, policyB, 'urn:2:survey:*');
      await setupScopeChain(scopeRepo, stmtB, 'urn:2:survey:*');

      const teamId = await createTeam(connection, 'Multi-Policy Team');
      await createTeamPolicy(connection, teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(connection, teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      expect(await countTeamScopes(teamId)).to.equal(2);
    });

    it('should not create duplicate team_security_scope for the same scope via another policy', async () => {
      const urn = 'urn:*:species_observation:*';

      const policyA = await createPolicy(connection, 'overlap-A');
      const stmtA = await createPolicyStatement(connection, policyA, urn);
      await setupScopeChain(scopeRepo, stmtA, urn);

      const policyB = await createPolicy(connection, 'overlap-B');
      const stmtB = await createPolicyStatement(connection, policyB, urn);
      await setupScopeChain(scopeRepo, stmtB, urn);

      const teamId = await createTeam(connection, 'Overlap Team');
      await createTeamPolicy(connection, teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(connection, teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      // Same scope via two policies → one row (ON CONFLICT DO NOTHING)
      expect(await countTeamScopes(teamId)).to.equal(1);
    });
  });

  // ── Search with security scopes ──────────────────────────────────────

  describe('Search with security scopes', () => {
    // Read-path security is resolved via the precomputed submission_feature_closure
    // (isEffectivelySecured / isAccessibleToUser), not a live recursive parent walk. The
    // closure is UPLOAD-SCOPED, so every fixture here seeds its features under a SHARED upload
    // (createTestUpload + insertFeatureRow) and rebuilds the closure AFTER seeding + securing and BEFORE
    // the first search — otherwise the fragment finds nothing and every feature reads as unsecured.
    it('should show authorized secured features to authenticated user with matching scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const openFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const securedFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedFeature);

      await rebuildClosure(uploadId);

      const userId = connection.systemUserId();
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, userId, 'Auth Team');

      const results = await searchInSubmission(submissionId, ['survey'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(openFeature);
      expect(featureIds).to.include(securedFeature);

      const secured = results.find((r) => r.submission_feature_id === securedFeature);
      expect(secured?.is_secured).to.be.true;
    });

    it('should hide secured features from anonymous user', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const openFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const securedFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedFeature);

      await rebuildClosure(uploadId);

      const results = await searchInSubmission(submissionId, ['survey'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(openFeature);
      expect(featureIds).to.not.include(securedFeature);
    });

    it('should hide secured features from authenticated user without matching scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const openFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const securedFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedFeature);

      await rebuildClosure(uploadId);

      // User exists but has no team/policy/scope
      const userId = await createOtherUser();

      const results = await searchInSubmission(submissionId, ['survey'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(openFeature);
      expect(featureIds).to.not.include(securedFeature);
    });

    it('should hide descendant from anonymous when only the grandparent is secured (deep hierarchy)', async () => {
      // Hierarchy: survey(secured) → sample_site(open) → species_observation(open), all under ONE upload
      // so the closure stores each descendant's ancestry up to the secured grandparent.
      // isEffectivelySecured resolves grandparent's security two levels up and hides the subtree.
      const { submissionId, grandparent, parent, child } = await seedSecuredGrandparentHierarchy();

      const results = await searchInSubmission(submissionId, ['survey', 'sample_site', 'species_observation'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      // All three should be hidden — grandparent is secured, and the closure ancestry
      // makes its descendants invisible to anonymous users
      expect(featureIds).to.not.include(grandparent);
      expect(featureIds).to.not.include(parent);
      expect(featureIds).to.not.include(child);
    });

    it('should grant authenticated user access to deep descendants via scope anchored at grandparent', async () => {
      // Hierarchy: survey(secured) → sample_site(open) → species_observation(open), all under ONE upload.
      // Scope anchored at survey. Authenticated user should see all three because isAccessibleToUser
      // Branch 2 finds the anchor in each feature's closure ancestry.
      const { submissionId, grandparent, parent, child } = await seedSecuredGrandparentHierarchy();

      const userId = connection.systemUserId();
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, userId, 'Deep Access Team');

      const results = await searchInSubmission(submissionId, ['survey', 'sample_site', 'species_observation'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      // All three visible — scope anchor at grandparent covers the entire subtree
      expect(featureIds).to.include(grandparent);
      expect(featureIds).to.include(parent);
      expect(featureIds).to.include(child);
    });

    it('should hide deep descendants from authenticated user without matching scope (deep hierarchy)', async () => {
      // Same hierarchy, but user has no scope — should behave like anonymous for secured subtree
      const { submissionId, grandparent, parent, child } = await seedSecuredGrandparentHierarchy();

      const userId = await createOtherUser();

      const results = await searchInSubmission(submissionId, ['survey', 'sample_site', 'species_observation'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.not.include(grandparent);
      expect(featureIds).to.not.include(parent);
      expect(featureIds).to.not.include(child);
    });

    it('should grant access to all secured features via wildcard scope', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const feat1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'survey' });
      const feat2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'survey' });
      await secureFeature(connection, feat1);
      await secureFeature(connection, feat2);

      await rebuildClosure(uploadId);

      const userId = connection.systemUserId();
      await setupFullAccess(connection, scopeRepo, 'urn:*:*:*', userId, 'Wildcard Team');

      const results = await searchInSubmission(submissionId, ['survey'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(feat1);
      expect(featureIds).to.include(feat2);
    });
  });

  // ── has_more_secured_features (hidden-secured-match signal) ───────────
  //
  // Drives the "Request Data" banner. True when the search matched secured features the caller
  // cannot access. Wildcard-grant holders are excluded via direct URN scope matching so anchor
  // recomputation lag does not raise a false positive.
  describe('hasInaccessibleSecuredFeaturesByExpressionTree', () => {
    it('is FALSE for a wildcard (urn:*:*:*) caller even when secured matches exist (AC3)', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const feat1 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
      const feat2 = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'dataset' });
      await secureFeature(connection, feat1);
      await secureFeature(connection, feat2);

      await rebuildClosure(uploadId);

      const userId = connection.systemUserId();
      await setupFullAccess(connection, scopeRepo, 'urn:*:*:*', userId, 'Wildcard Team');

      const hasHidden = await searchRepo.hasInaccessibleSecuredFeaturesByExpressionTree('dataset', undefined, userId);

      // The caller can access every secured match via the wildcard grant — nothing left to request.
      expect(hasHidden).to.be.false;
    });

    it('is TRUE for a wildcard caller when a secured match has no anchor yet (anchor lag — banner shows transiently)', async () => {
      // A feature secured AFTER the wildcard scope's anchors were computed has no security_scope_anchor
      // (recompute lag), so isAccessibleToUser reports it inaccessible to everyone — the wildcard caller
      // included. The banner probe is anchor-only (kept consistent with the visible-results access
      // filter), so it raises the flag during this short (~10s) recompute window until anchors catch up.
      // Accepted tradeoff: a brief false-positive banner rather than a more permissive probe that would
      // hide the banner while the rows themselves stay filtered out.
      const submissionId = await createTestSubmission(connection);
      const feature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Lagged Secured' });
      await rebuildClosureForSubmission(submissionId);

      const wildcardUser = connection.systemUserId();
      // Grant wildcard access BEFORE the feature is secured, so the anchor computation does not cover it.
      await setupFullAccess(connection, scopeRepo, 'urn:*:*:*', wildcardUser, 'Wildcard Team');

      // Now secure it — effectively secured on the read path, but with no scope anchor.
      await secureFeature(connection, feature);

      const hasHidden = await searchRepo.hasInaccessibleSecuredFeaturesByExpressionTree(
        'dataset',
        undefined,
        wildcardUser
      );

      expect(hasHidden).to.be.true;
    });

    it('is TRUE when a secured match is grantable to another team but not the caller (AC2)', async () => {
      const submissionId = await createTestSubmission(connection);
      const feature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Other Team Secured' });
      await secureFeature(connection, feature);
      await rebuildClosureForSubmission(submissionId);

      // Grant access to a DIFFERENT user's team — the feature now has an anchor + standing grant,
      // so it is requestable, just not by our caller.
      const otherUser = await createOtherUser();
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:*:*`, otherUser, 'Other Team');

      const caller = await createOtherUser(); // authenticated, but in no team
      const hasHidden = await searchRepo.hasInaccessibleSecuredFeaturesByExpressionTree('dataset', undefined, caller);

      expect(hasHidden).to.be.true;
    });

    it('is TRUE for an anonymous caller when secured matches exist (AC4)', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const feature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'dataset'
      });
      await secureFeature(connection, feature);
      await rebuildClosure(uploadId);

      const hasHidden = await searchRepo.hasInaccessibleSecuredFeaturesByExpressionTree('dataset', undefined, null);

      expect(hasHidden).to.be.true;
    });

    it('is TRUE for an authenticated caller with no covering policy (AC2 — banner shows)', async () => {
      const submissionId = await createTestSubmission(connection);
      const feature = await createTestFeature(connection, submissionId, 'dataset', { name: 'Ungranted Secured' });
      await secureFeature(connection, feature);
      await rebuildClosureForSubmission(submissionId);

      // Authenticated, but holds no team/policy/scope at all.
      const caller = await createOtherUser();
      const hasHidden = await searchRepo.hasInaccessibleSecuredFeaturesByExpressionTree('dataset', undefined, caller);

      expect(hasHidden).to.be.true;
    });
  });

  // ── Policy deletion → scope cleanup ──────────────────────────────────

  describe('Policy deletion → scope cleanup', () => {
    it('should remove team_security_scope entries when policy statements are deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Test' });
      await secureFeature(connection, featureId);

      const userId = connection.systemUserId();
      const { stmtId, teamId } = await setupFullAccess(
        connection,
        scopeRepo,
        `urn:${submissionId}:*:*`,
        userId,
        'Delete Scope Team'
      );

      expect(await countTeamScopes(teamId)).to.be.greaterThan(0);

      await softDeleteStatement(stmtId);
      await scopeService.rebuildTeamSecurityScopesForTeams([teamId]);

      expect(await countTeamScopes(teamId)).to.equal(0);
    });

    it('should preserve security_scope_anchor rows when last policy reference is removed', async () => {
      const { stmtId, scopeId } = await setupSecuredScope('Orphan Anchor', 'orphan-test');

      expect(await countAnchors(scopeId)).to.be.greaterThan(0);
      const anchorsBefore = await countAnchors(scopeId);

      // Soft-delete statement and rebuild team grants — scope becomes unused,
      // but anchors remain reusable cache rows.
      await softDeleteStatement(stmtId);
      await scopeService.rebuildTeamSecurityScopesForTeams([]);

      await refreshAnchorsViaService(scopeId);

      expect(await countAnchors(scopeId)).to.equal(anchorsBefore);
    });

    it('should preserve anchors for shared scopes when one policy is deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'survey', { name: 'Shared Scope' });
      await secureFeature(connection, featureId);
      await rebuildClosureForSubmission(submissionId);

      // Two policies with the same URN → shared scope
      const urn = `urn:${submissionId}:*:*`;

      const policyA = await createPolicy(connection, 'shared-A');
      const stmtA = await createPolicyStatement(connection, policyA, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtA, urn);

      const policyB = await createPolicy(connection, 'shared-B');
      const stmtB = await createPolicyStatement(connection, policyB, urn);
      await setupScopeChain(scopeRepo, stmtB, urn); // Same scope reused

      const anchorsBefore = await countAnchors(scopeId);
      expect(anchorsBefore).to.be.greaterThan(0);

      // Delete policy A's statement — scope still referenced by policy B
      await softDeleteStatement(stmtA);
      await scopeService.rebuildTeamSecurityScopesForTeams([]);

      // Anchors preserved — scope is NOT orphaned
      expect(await countAnchors(scopeId)).to.equal(anchorsBefore);
    });

    it('should block search access after policy deletion makes scope orphaned', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const securedFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedFeature);

      await rebuildClosure(uploadId);

      const userId = connection.systemUserId();
      const { stmtId, teamId } = await setupFullAccess(
        connection,
        scopeRepo,
        `urn:${submissionId}:*:*`,
        userId,
        'Block Team'
      );

      // Before: user can see the secured feature
      const before = await searchInSubmission(submissionId, ['survey'], userId);
      expect(before.map((r) => r.submission_feature_id)).to.include(securedFeature);

      await softDeleteStatement(stmtId);
      await scopeService.rebuildTeamSecurityScopesForTeams([teamId]);

      // After: user can no longer see the secured feature
      const after = await searchInSubmission(submissionId, ['survey'], userId);
      expect(after.map((r) => r.submission_feature_id)).to.not.include(securedFeature);
    });
  });

  // ── Policy update → scope replacement ────────────────────────────────

  describe('Policy update → scope replacement', () => {
    it('should replace team access while preserving reusable anchors when statements are updated', async () => {
      // Two submissions, each with a secured feature under its own upload (closure rebuilt per upload)
      const { submissionId: sub1, featureId: feat1 } = await seedSecuredSurvey();
      const { submissionId: sub2, featureId: feat2 } = await seedSecuredSurvey();

      // Policy initially targets sub1
      const policyId = await createPolicy(connection, 'update-test');
      const oldStmtId = await createPolicyStatement(connection, policyId, `urn:${sub1}:*:*`);
      const oldScopeId = await setupScopeChain(scopeRepo, oldStmtId, `urn:${sub1}:*:*`);

      const userId = connection.systemUserId();
      const teamId = await createTeam(connection, 'Update Team');
      await addTeamMember(connection, teamId, userId);
      await createTeamPolicy(connection, teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      // Before: sub1 accessible, sub2 not
      expect((await searchInSubmission(sub1, ['survey'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat1
      );
      expect((await searchInSubmission(sub2, ['survey'], userId)).map((r) => r.submission_feature_id)).to.not.include(
        feat2
      );

      // Simulate update: soft-delete old statement, cleanup, create new for sub2
      await softDeleteStatement(oldStmtId);
      await scopeService.rebuildTeamSecurityScopesForTeams([teamId]);

      const oldAnchorsBeforeRefresh = await countAnchors(oldScopeId);
      await refreshAnchorsViaService(oldScopeId);

      // Old scope's anchors are preserved for future reuse.
      expect(await countAnchors(oldScopeId)).to.equal(oldAnchorsBeforeRefresh);

      // Create new statement and scope chain for sub2
      const newStmtId = await createPolicyStatement(connection, policyId, `urn:${sub2}:*:*`);
      await setupScopeChain(scopeRepo, newStmtId, `urn:${sub2}:*:*`);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // After: sub2 accessible, sub1 not
      expect((await searchInSubmission(sub1, ['survey'], userId)).map((r) => r.submission_feature_id)).to.not.include(
        feat1
      );
      expect((await searchInSubmission(sub2, ['survey'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat2
      );
    });
  });

  // ── Team-policy deletion → access removal ────────────────────────────

  describe('Team-policy deletion → access removal', () => {
    it('should remove team access and block search when team-policy is deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const securedFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedFeature);

      await rebuildClosure(uploadId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'team-delete-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      await setupScopeChain(scopeRepo, stmtId, urn);

      const userId = connection.systemUserId();
      const teamId = await createTeam(connection, 'Team Delete');
      await addTeamMember(connection, teamId, userId);
      const teamPolicyId = await createTeamPolicy(connection, teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      // Before: user can see secured feature
      const before = await searchInSubmission(submissionId, ['survey'], userId);
      expect(before.map((r) => r.submission_feature_id)).to.include(securedFeature);

      // Soft-delete team-policy, rebuild team scopes
      await softDeleteTeamPolicy(teamPolicyId);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // team_security_scope rows removed
      expect(await countTeamScopes(teamId)).to.equal(0);

      // After: user can no longer see secured feature
      const after = await searchInSubmission(submissionId, ['survey'], userId);
      expect(after.map((r) => r.submission_feature_id)).to.not.include(securedFeature);
    });

    it('should preserve scopes from remaining policies when one team-policy is deleted', async () => {
      // Team has Policy A (sub1 scope) and Policy B (sub2 scope).
      // Deleting team-policy A should leave sub2's scope intact.
      const { submissionId: sub1, featureId: feat1 } = await seedSecuredSurvey();
      const { submissionId: sub2, featureId: feat2 } = await seedSecuredSurvey();

      // Policy A covers sub1, Policy B covers sub2
      const policyA = await createPolicy(connection, 'multi-tp-A');
      const stmtA = await createPolicyStatement(connection, policyA, `urn:${sub1}:*:*`);
      await setupScopeChain(scopeRepo, stmtA, `urn:${sub1}:*:*`);

      const policyB = await createPolicy(connection, 'multi-tp-B');
      const stmtB = await createPolicyStatement(connection, policyB, `urn:${sub2}:*:*`);
      await setupScopeChain(scopeRepo, stmtB, `urn:${sub2}:*:*`);

      const userId = connection.systemUserId();
      const teamId = await createTeam(connection, 'Multi-Policy Team');
      await addTeamMember(connection, teamId, userId);

      const tpA = await createTeamPolicy(connection, teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(connection, teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      // Before: user sees both secured features, team has 2 scopes
      expect(await countTeamScopes(teamId)).to.equal(2);
      expect((await searchInSubmission(sub1, ['survey'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat1
      );
      expect((await searchInSubmission(sub2, ['survey'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat2
      );

      // Delete team-policy A, rebuild
      await softDeleteTeamPolicy(tpA);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // After: team has 1 scope, sub2 still accessible, sub1 blocked
      expect(await countTeamScopes(teamId)).to.equal(1);
      expect((await searchInSubmission(sub2, ['survey'], userId)).map((r) => r.submission_feature_id)).to.include(
        feat2
      );
      expect((await searchInSubmission(sub1, ['survey'], userId)).map((r) => r.submission_feature_id)).to.not.include(
        feat1
      );
    });

    it('should preserve overlapping scope when one of two team-policies sharing it is deleted', async () => {
      // Policy A and Policy B both use same URN → same shared scope.
      // Deleting team-policy A should leave the scope intact via Policy B.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const securedFeature = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, securedFeature);

      await rebuildClosure(uploadId);

      const urn = `urn:${submissionId}:*:*`;

      const policyA = await createPolicy(connection, 'overlap-tp-A');
      const stmtA = await createPolicyStatement(connection, policyA, urn);
      await setupScopeChain(scopeRepo, stmtA, urn);

      const policyB = await createPolicy(connection, 'overlap-tp-B');
      const stmtB = await createPolicyStatement(connection, policyB, urn);
      await setupScopeChain(scopeRepo, stmtB, urn); // Same scope reused

      const userId = connection.systemUserId();
      const teamId = await createTeam(connection, 'Overlap TP Team');
      await addTeamMember(connection, teamId, userId);

      const tpA = await createTeamPolicy(connection, teamId, policyA);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyA);
      await createTeamPolicy(connection, teamId, policyB);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyB);

      // Before: 1 scope (deduped), user sees secured feature
      expect(await countTeamScopes(teamId)).to.equal(1);
      expect(
        (await searchInSubmission(submissionId, ['survey'], userId)).map((r) => r.submission_feature_id)
      ).to.include(securedFeature);

      // Delete team-policy A, rebuild
      await softDeleteTeamPolicy(tpA);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // After: still 1 scope (via Policy B), user still sees feature
      expect(await countTeamScopes(teamId)).to.equal(1);
      expect(
        (await searchInSubmission(submissionId, ['survey'], userId)).map((r) => r.submission_feature_id)
      ).to.include(securedFeature);
    });
  });

  // ── Security rule mutations → anchor updates ─────────────────────────

  describe('Security rule mutations → anchor updates', () => {
    it('should compute new anchors when security rules are applied to features matching existing scopes', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'survey', { name: 'Already Secured' });
      await secureFeature(connection, feat1);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'new-anchor-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      const anchorsBefore = await countAnchors(scopeId);

      // Secure a NEW feature in the same submission
      const feat2 = await createTestFeature(connection, submissionId, 'survey', { name: 'Newly Secured' });
      await secureFeature(connection, feat2);
      await rebuildClosureForSubmission(submissionId);

      // Recompute anchors — new secured feature should become an anchor
      await computeAnchors(scopeRepo, scopeId);

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
      // Key regression test for multi-level ancestry in anchor pruning. A single-level parent
      // check would see child's immediate parent (parent) is NOT secured and incorrectly make
      // child an anchor. The recompute's live ancestor_walk reaches grandparent (secured) two
      // levels up — whose own closure self-loop makes it read as effectively secured — and
      // correctly prunes child.
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'survey', { name: 'Grandparent' });
      const parent = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Parent' }, grandparent);
      const child = await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parent);

      // Secure grandparent and child, but NOT parent — gap in the chain
      await secureFeature(connection, grandparent);
      await secureFeature(connection, child);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'gap-hierarchy-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      const anchorIds = await getAnchorIds(scopeId);
      // Grandparent is the root secured feature — it IS an anchor
      expect(anchorIds).to.include(grandparent);
      // Child has a secured ancestor (grandparent) — it is NOT an anchor
      expect(anchorIds).to.not.include(child);
    });

    it('should anchor a secured leaf when no ancestor is secured', async () => {
      // Hierarchy: grandparent → parent → child
      // Secured:   NO             NO       YES
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'survey', { name: 'Grandparent' });
      const parent = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Parent' }, grandparent);
      const child = await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parent);

      // Only the leaf is secured
      await secureFeature(connection, child);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'leaf-only-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      // Child has no secured ancestors — it IS the anchor
      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(child);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor only the mid-level feature when it alone is secured', async () => {
      // Hierarchy: grandparent → parent → child
      // Secured:   NO             YES      NO
      const submissionId = await createTestSubmission(connection);
      const grandparent = await createTestFeature(connection, submissionId, 'survey', { name: 'Grandparent' });
      const parent = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Parent' }, grandparent);
      await createTestFeature(connection, submissionId, 'species_observation', { name: 'Child' }, parent);

      // Only the middle level is secured
      await secureFeature(connection, parent);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'mid-only-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      // Parent has no secured ancestors — it IS the anchor
      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(parent);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should delete anchors and make features publicly visible when security rules are removed', async () => {
      const { submissionId, featureId, scopeId } = await setupSecuredScope('Going Public', 'unsecure-test');

      expect(await countAnchors(scopeId)).to.be.greaterThan(0);

      // Anonymous cannot see the secured feature
      const beforeAnon = await searchInSubmission(submissionId, ['survey'], null);
      expect(beforeAnon.map((r) => r.submission_feature_id)).to.not.include(featureId);

      // Remove security + recompute anchors (stale anchor gets cleaned up)
      await unsecureFeature(featureId);
      await deleteStaleAnchors(scopeId);
      await computeAnchors(scopeRepo, scopeId);

      // Anchor deleted
      const anchorResult = await connection.sql(SQL`
        SELECT count(*)::integer as count FROM security_scope_anchor
        WHERE anchor_submission_feature_id = ${featureId};
      `);
      expect(anchorResult.rows[0].count).to.equal(0);

      // Now anonymous CAN see the feature (no longer secured)
      const afterAnon = await searchInSubmission(submissionId, ['survey'], null);
      const feature = afterAnon.find((r) => r.submission_feature_id === featureId);
      expect(feature).to.not.be.undefined;
      expect(feature?.is_secured).to.be.false;
    });

    it('should anchor child feature via inherited security from parent (type-scoped URN)', async () => {
      const { childId, scopeId } = await setupInheritedSecurityScope('telemetry', 'inherited-security-test');

      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(childId);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor specific child feature via inherited security (feature-scoped URN)', async () => {
      // Two telemetry children inherit security from the survey — only the one named in the URN
      // is anchored. The hierarchy is seeded under ONE upload so the closure stores each child's
      // ancestor edge to the secured survey (inherited security needs closure ancestry, not just
      // self-loops).
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const survey = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const telemetry1 = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'telemetry',
        parentFeatureId: survey
      });
      const telemetry2 = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'telemetry',
        parentFeatureId: survey
      });
      await secureFeature(connection, survey);
      await rebuildClosure(uploadId);

      const urn = `urn:${submissionId}:telemetry:${telemetry1}`;
      const policyId = await createPolicy(connection, 'feature-scoped-inherited-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(telemetry1);
      expect(anchorIds).to.not.include(telemetry2);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should not anchor child when parent is unsecured (no inherited security)', async () => {
      // Neither feature is secured — no anchors should be created
      const submissionId = await createTestSubmission(connection);
      const survey = await createTestFeature(connection, submissionId, 'survey', { name: 'Public Survey' });
      await createTestFeature(connection, submissionId, 'telemetry', { name: 'Public Telemetry' }, survey);
      // Build the self-loops so both unsecured features read as effectively unsecured rather than
      // hidden-by-default — isEffectivelySecured fails closed when a feature has no closure rows.
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:telemetry:*`;
      const policyId = await createPolicy(connection, 'no-security-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should remove inherited anchor when parent is unsecured (stale cleanup)', async () => {
      const { surveyId, childId, scopeId } = await setupInheritedSecurityScope('telemetry', 'stale-inherited-test');

      expect(await getAnchorIds(scopeId)).to.include(childId);

      // Unsecure the parent — child loses inherited security
      await unsecureFeature(surveyId);
      await deleteStaleAnchors(scopeId);
      await computeAnchors(scopeRepo, scopeId);

      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should anchor deep descendant via multi-level inherited security', async () => {
      // survey → sample_site → telemetry (2 levels deep), all under ONE upload so the closure
      // stores telemetry's ancestry up to the secured survey (inherited security needs closure
      // ancestry).
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const survey = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      const sampleSite = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site',
        parentFeatureId: survey
      });
      const telemetry = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'telemetry',
        parentFeatureId: sampleSite
      });
      await secureFeature(connection, survey);
      await rebuildClosure(uploadId);

      const urn = `urn:${submissionId}:telemetry:*`;
      const policyId = await createPolicy(connection, 'deep-inherited-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(telemetry);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should grant search access to child feature via inherited anchor (end-to-end)', async () => {
      const { submissionId, childId: telemetry } = await setupInheritedSecurityScope('telemetry', 'e2e-inherited-test');

      const userId = connection.systemUserId();
      await setupFullAccess(connection, scopeRepo, `urn:${submissionId}:telemetry:*`, userId, 'Inherited Access Team');

      // Anonymous: telemetry should be hidden (parent is secured)
      const anonResults = await searchInSubmission(submissionId, ['telemetry'], null);
      expect(anonResults.map((r) => r.submission_feature_id)).to.not.include(telemetry);

      // Authenticated with scope: telemetry should be visible
      const authResults = await searchInSubmission(submissionId, ['telemetry'], userId);
      expect(authResults.map((r) => r.submission_feature_id)).to.include(telemetry);
    });

    it('should delete anchors only for unsecured features, preserving anchors for still-secured features', async () => {
      // 3 secured features → 3 anchors. Unsecure 2, delete their anchors.
      // The remaining feature's anchor should be untouched.
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'survey', { name: 'Stay Secured' });
      const feat2 = await createTestFeature(connection, submissionId, 'survey', { name: 'Going Public 1' });
      const feat3 = await createTestFeature(connection, submissionId, 'survey', { name: 'Going Public 2' });
      await secureFeature(connection, feat1);
      await secureFeature(connection, feat2);
      await secureFeature(connection, feat3);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'selective-anchor-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      // All 3 features are anchors
      expect(await countAnchors(scopeId)).to.equal(3);

      // Unsecure feat2 and feat3, recompute anchors (stale anchors get cleaned up)
      await unsecureFeature(feat2);
      await unsecureFeature(feat3);
      await deleteStaleAnchors(scopeId);
      await computeAnchors(scopeRepo, scopeId);

      // feat1's anchor remains, feat2 and feat3 are gone
      expect(await countAnchors(scopeId)).to.equal(1);

      const remaining = await connection.sql(SQL`
        SELECT anchor_submission_feature_id FROM security_scope_anchor
        WHERE security_scope_id = ${scopeId};
      `);
      expect(remaining.rows[0].anchor_submission_feature_id).to.equal(feat1);
    });
  });

  // ── record_effective_date → search visibility ───────────────────────

  describe('record_effective_date → search visibility', () => {
    // Read-path security reads the closure. The closure's active universe is record_end_date IS NULL only
    // (it does NOT filter on record_effective_date), so the self-loop / ancestry rows exist regardless of
    // approval; the effective-date predicate lives in isEffectivelySecured (sf_sec.record_effective_date
    // <= now()). Each fixture seeds under a SHARED upload and rebuilds the closure before searching.
    for (const { label, markFn } of [
      { label: 'NULL', markFn: markFeatureUnapproved },
      { label: 'in the future', markFn: markFeatureFutureDate }
    ] as const) {
      it(`should NOT hide feature from anonymous when security rule exists but record_effective_date is ${label}`, async () => {
        const submissionId = await createTestSubmission(connection);
        const uploadId = await createTestUpload(connection, submissionId);
        const featureId = await insertFeatureRow({
          submissionId,
          submissionUploadId: uploadId,
          featureTypeName: 'survey'
        });
        await secureFeature(connection, featureId);
        await markFn(featureId);

        await rebuildClosure(uploadId);

        const results = await searchInSubmission(submissionId, ['survey'], null);
        const featureIds = results.map((r) => r.submission_feature_id);

        expect(featureIds).to.include(featureId);
        const feature = results.find((r) => r.submission_feature_id === featureId);
        expect(feature?.is_secured).to.be.false;
      });
    }

    it('should hide feature from anonymous when security rule exists and record_effective_date is approved', async () => {
      // Baseline: insertFeatureRow sets record_effective_date = now(), so feature
      // with a security rule IS effectively secured. Anonymous should NOT see it.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, featureId);

      await rebuildClosure(uploadId);

      const results = await searchInSubmission(submissionId, ['survey'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.not.include(featureId);
    });

    it('should NOT hide child from anonymous when parent is secured but unapproved (NULL date)', async () => {
      // Parent has a security rule but NULL record_effective_date. The parent is
      // NOT effectively secured, so its child should remain visible.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const parent = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'survey' });
      const child = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site',
        parentFeatureId: parent
      });
      await secureFeature(connection, parent);
      await markFeatureUnapproved(parent);

      await rebuildClosure(uploadId);

      const results = await searchInSubmission(submissionId, ['survey', 'sample_site'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(parent);
      expect(featureIds).to.include(child);
    });

    it('should hide child from anonymous when parent is secured and approved', async () => {
      // Parent has a security rule AND record_effective_date = now(). The parent IS
      // effectively secured, so its child inherits security via closure ancestry and is hidden.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const parent = await insertFeatureRow({ submissionId, submissionUploadId: uploadId, featureTypeName: 'survey' });
      const child = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'sample_site',
        parentFeatureId: parent
      });
      await secureFeature(connection, parent);

      await rebuildClosure(uploadId);

      const results = await searchInSubmission(submissionId, ['survey', 'sample_site'], null);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.not.include(parent);
      expect(featureIds).to.not.include(child);
    });

    it('should NOT hide feature from authenticated user (no scope) when record_effective_date is NULL', async () => {
      // Authenticated user without scope grants sees the same as anonymous for the
      // "not secured" branch. Unapproved security rule → feature is visible.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, featureId);
      await markFeatureUnapproved(featureId);

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      const results = await searchInSubmission(submissionId, ['survey'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(featureId);
    });

    it('should NOT hide feature from authenticated user (no scope) when record_effective_date is in the future', async () => {
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, featureId);
      await markFeatureFutureDate(featureId);

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      const results = await searchInSubmission(submissionId, ['survey'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.include(featureId);
    });

    it('should hide feature from authenticated user (no scope) when record_effective_date is approved', async () => {
      // Approved security rule + no scope grant → feature is hidden, same as anonymous.
      const submissionId = await createTestSubmission(connection);
      const uploadId = await createTestUpload(connection, submissionId);
      const featureId = await insertFeatureRow({
        submissionId,
        submissionUploadId: uploadId,
        featureTypeName: 'survey'
      });
      await secureFeature(connection, featureId);

      await rebuildClosure(uploadId);

      const userId = await createOtherUser();
      const results = await searchInSubmission(submissionId, ['survey'], userId);
      const featureIds = results.map((r) => r.submission_feature_id);

      expect(featureIds).to.not.include(featureId);
    });
  });

  describe('Upload status → anchor eligibility', () => {
    it('should exclude features from denied uploads when computing anchors', async () => {
      const scopeId = await setupApprovalTest('Denied Survey', 'denied-upload-test', { approved: false });
      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should exclude features from unreviewed uploads when computing anchors', async () => {
      const scopeId = await setupApprovalTest('Unreviewed Survey', 'unreviewed-upload-test', { approved: false });
      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should include features from approved uploads when computing anchors', async () => {
      // createTestFeature defaults record_effective_date = now(), simulating an approved upload
      const scopeId = await setupApprovalTest('Approved Survey', 'approved-upload-test');

      expect(await countAnchors(scopeId)).to.equal(1);
    });

    it('should exclude features with future record_effective_date when computing anchors', async () => {
      // A feature whose upload is approved but with a future effective date should
      // not be anchored — isEffectivelySecured requires record_effective_date <= now().
      const submissionId = await createTestSubmission(connection);
      const survey = await createTestFeature(connection, submissionId, 'survey', { name: 'Future Survey' });
      await secureFeature(connection, survey);

      await markFeatureFutureDate(survey);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'future-date-anchor-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      expect(await countAnchors(scopeId)).to.equal(0);
    });

    it('should prune anchor when record_effective_date is set to NULL after initial computation', async () => {
      // Compute anchors for an approved+secured feature, then de-approve it.
      // deleteStaleAnchorBatch should remove the now-stale anchor.
      const { featureId: survey, scopeId } = await setupSecuredScope('De-approved Survey', 'de-approve-anchor-test');

      // Anchor exists for the approved+secured feature
      expect(await countAnchors(scopeId)).to.equal(1);

      // De-approve: set record_effective_date to NULL
      await markFeatureUnapproved(survey);

      await deleteStaleAnchors(scopeId);

      expect(await countAnchors(scopeId)).to.equal(0);
    });
  });

  describe('Narrowed URN anchor computation', () => {
    it('should anchor a specific feature by ID even when its ancestor is secured', async () => {
      const { telemetry, scopeId } = await setupDeepHierarchyScope(
        ['survey', 'telemetry'],
        (ids) => `urn:${ids.submissionId}:*:${ids.telemetry}`,
        'specific-feature-urn-test'
      );

      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(telemetry);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor type-scoped features even when a different-type ancestor is secured', async () => {
      const { telemetry, scopeId } = await setupDeepHierarchyScope(
        ['survey', 'observation', 'telemetry'],
        (ids) => `urn:${ids.submissionId}:telemetry:*`,
        'type-scoped-urn-test'
      );

      const anchorIds = await getAnchorIds(scopeId);
      expect(anchorIds).to.include(telemetry);
      expect(anchorIds).to.have.lengthOf(1);
    });

    it('should anchor a specific feature by ID with wildcard submission', async () => {
      const { telemetry, scopeId } = await setupDeepHierarchyScope(
        ['survey', 'telemetry'],
        (ids) => `urn:*:*:${ids.telemetry}`,
        'wildcard-sub-specific-feature-test'
      );

      const anchorIds = await getAnchorIds(scopeId);
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
      await secureFeature(connection, telem1);

      const sub2 = await createTestSubmission(connection);
      const telem2 = await createTestFeature(connection, sub2, 'telemetry', { name: 'Telem 2' });
      await secureFeature(connection, telem2);

      // Also create a secured survey feature — it should NOT match the telemetry scope
      const survey = await createTestFeature(connection, sub1, 'survey', { name: 'Survey' });
      await secureFeature(connection, survey);

      await rebuildClosureForSubmission(sub1);
      await rebuildClosureForSubmission(sub2);

      const urn = 'urn:*:telemetry:*';
      const policyId = await createPolicy(connection, 'wildcard-sub-type-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      const anchorIds = await getAnchorIds(scopeId);
      // Both telemetry features are anchors (cross-submission wildcard match)
      expect(anchorIds).to.include(telem1);
      expect(anchorIds).to.include(telem2);
      // Survey feature excluded — wrong feature type for this scope
      expect(anchorIds).to.not.include(survey);
    });
  });

  // ── URN revert → reusable scope anchors are retained ────────────────

  describe('URN revert → reusable scope anchors are retained', () => {
    it('should have anchors after changing URN away and back to the original', async () => {
      // Reproduces: policy starts as urn:{sub}:*:*, changed to urn:{sub}:*:{id},
      // then changed back to urn:{sub}:*:*. The revert finds the existing
      // security_scope row (scope_hash match). Anchors should still be present
      // because policy changes revoke access through team_security_scope, not by
      // deleting reusable security_scope_anchor rows.
      //
      // Uses submission-scoped URNs to avoid collisions with seed data policies.
      const submissionId = await createTestSubmission(connection);
      const survey = await createTestFeature(connection, submissionId, 'survey', { name: 'Survey' });
      const child = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Child' }, survey);

      await secureFeature(connection, survey);
      await secureFeature(connection, child);
      await rebuildClosureForSubmission(submissionId);

      // ── Step 1: Policy with urn:{sub}:*:* (broad) ──
      const broadUrn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'revert-test');
      const stmt1 = await createPolicyStatement(connection, policyId, broadUrn);
      const broadScopeId = await setupScopeChain(scopeRepo, stmt1, broadUrn);

      const userId = connection.systemUserId();
      const teamId = await createTeam(connection, 'Revert Team');
      await addTeamMember(connection, teamId, userId);
      await createTeamPolicy(connection, teamId, policyId);
      await scopeRepo.insertTeamSecurityScopesForPolicy(teamId, policyId);

      // Anchors exist (survey is the root anchor)
      expect(await countAnchors(broadScopeId)).to.be.greaterThan(0);

      // ── Step 2: Change URN to urn:{sub}:*:{childId} (narrow) ──
      await softDeleteStatement(stmt1);
      // Cleanup: remove old direct scope grants and rebuild team scopes
      await scopeService.rebuildTeamSecurityScopesForTeams([teamId]);
      const broadAnchorsBeforePrune = await countAnchors(broadScopeId);
      await deleteStaleAnchorsViaService(broadScopeId);

      // Broad scope anchors remain cached while no active policy references them.
      expect(await countAnchors(broadScopeId)).to.equal(broadAnchorsBeforePrune);

      // Create new narrow statement
      const narrowUrn = `urn:${submissionId}:*:${child}`;
      const stmt2 = await createPolicyStatement(connection, policyId, narrowUrn);
      const narrowScopeId = await setupScopeChain(scopeRepo, stmt2, narrowUrn);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      expect(await countAnchors(narrowScopeId)).to.be.greaterThan(0);

      // ── Step 3: Revert back to urn:{sub}:*:* (broad again) ──
      await softDeleteStatement(stmt2);
      await scopeService.rebuildTeamSecurityScopesForTeams([teamId]);
      await deleteStaleAnchorsViaService(narrowScopeId);

      // Re-create the original broad statement
      const stmt3 = await createPolicyStatement(connection, policyId, broadUrn);
      // setupScopeChain mirrors the real service: insertSecurityScope returns null
      // (scope_hash already exists from Step 1), so it reuses the existing scope
      // and reuses the cached anchors.
      const reusedScopeId = await setupScopeChain(scopeRepo, stmt3, broadUrn);
      await scopeRepo.deleteTeamSecurityScopes(teamId);
      await scopeRepo.insertTeamSecurityScopesFromPolicyChain(teamId);

      // Same scope reused (same hash)
      expect(reusedScopeId).to.equal(broadScopeId);

      // Team has the scope mapped
      expect(await countTeamScopes(teamId)).to.be.greaterThan(0);

      const anchorCount = await countAnchors(reusedScopeId);
      expect(anchorCount).to.be.greaterThan(0);
    });
  });

  // ── findScopeIdsMatchingSubmission → URN pattern matching ───────────

  describe('findScopeIdsMatchingSubmission → URN pattern matching', () => {
    // Seed data may include security scopes with wildcard URNs (urn_submission_id = '*')
    // that match any submission. Tests use a baseline snapshot to isolate assertions
    // to scopes created within the test.
    //
    // A live team_policy link is required for the gate (SIMSBIOHUB-985 invariant) —
    // each test wires one so the URN-matching predicates are what's actually being
    // exercised. Tests that target the gate itself live in the next describe block.

    it('should match a submission-scoped URN (urn:{subId}:*:*)', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy(connection, 'sub-scope-match');
      const stmtId = await createPolicyStatement(connection, policyId, `urn:${submissionId}:*:*`);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, `urn:${submissionId}:*:*`);
      const teamId = await createTeam(connection, 'sub-scope-team');
      await createTeamPolicy(connection, teamId, policyId);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length + 1);
    });

    it('should match a wildcard URN (urn:*:*:*) for any submission', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy(connection, 'wildcard-match');
      const stmtId = await createPolicyStatement(connection, policyId, 'urn:*:*:*');
      const scopeId = await setupScopeChain(scopeRepo, stmtId, 'urn:*:*:*');
      const teamId = await createTeam(connection, 'wildcard-team');
      await createTeamPolicy(connection, teamId, policyId);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length + 1);
    });

    it('should match a type-scoped wildcard URN (urn:*:telemetry:*) for any submission', async () => {
      const submissionId = await createTestSubmission(connection);

      const policyId = await createPolicy(connection, 'type-wildcard-match');
      const stmtId = await createPolicyStatement(connection, policyId, 'urn:*:telemetry:*');
      const scopeId = await setupScopeChain(scopeRepo, stmtId, 'urn:*:telemetry:*');
      const teamId = await createTeam(connection, 'type-wildcard-team');
      await createTeamPolicy(connection, teamId, policyId);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      // urn_submission_id = '*' matches any submission
      expect(scopeIds).to.include(scopeId);
    });

    it('should not match a submission-scoped URN for a different submission', async () => {
      const sub1 = await createTestSubmission(connection);
      const sub2 = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(sub2);

      const policyId = await createPolicy(connection, 'no-match');
      const stmtId = await createPolicyStatement(connection, policyId, `urn:${sub1}:*:*`);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, `urn:${sub1}:*:*`);
      const teamId = await createTeam(connection, 'no-match-team');
      await createTeamPolicy(connection, teamId, policyId);

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
      const policyA = await createPolicy(connection, 'specific-match');
      const stmtA = await createPolicyStatement(connection, policyA, `urn:${submissionId}:*:*`);
      const scopeIdA = await setupScopeChain(scopeRepo, stmtA, `urn:${submissionId}:*:*`);
      const teamA = await createTeam(connection, 'specific-team');
      await createTeamPolicy(connection, teamA, policyA);

      // Wildcard scope (different hash → different scope row)
      const policyB = await createPolicy(connection, 'wildcard-also-match');
      const stmtB = await createPolicyStatement(connection, policyB, 'urn:*:*:*');
      const scopeIdB = await setupScopeChain(scopeRepo, stmtB, 'urn:*:*:*');
      const teamB = await createTeam(connection, 'wildcard-also-team');
      await createTeamPolicy(connection, teamB, policyB);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.include(scopeIdA);
      expect(scopeIds).to.include(scopeIdB);
      expect(result).to.have.lengthOf(baseline.length + 2);
    });

    it('should not match soft-deleted policy statements', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy(connection, 'soft-deleted-match');
      const stmtId = await createPolicyStatement(connection, policyId, `urn:${submissionId}:*:*`);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, `urn:${submissionId}:*:*`);
      const teamId = await createTeam(connection, 'soft-deleted-team');
      await createTeamPolicy(connection, teamId, policyId);

      await softDeleteStatement(stmtId);

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
      const policyA = await createPolicy(connection, 'dedup-A');
      const stmtA = await createPolicyStatement(connection, policyA, urn);
      const scopeIdA = await setupScopeChain(scopeRepo, stmtA, urn);
      const teamA = await createTeam(connection, 'dedup-team-A');
      await createTeamPolicy(connection, teamA, policyA);

      const policyB = await createPolicy(connection, 'dedup-B');
      const stmtB = await createPolicyStatement(connection, policyB, urn);
      const scopeIdB = await setupScopeChain(scopeRepo, stmtB, urn);
      const teamB = await createTeam(connection, 'dedup-team-B');
      await createTeamPolicy(connection, teamB, policyB);

      // Same scope_hash → same scope row
      expect(scopeIdA).to.equal(scopeIdB);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      // DISTINCT in the query → only 1 new scope despite 2 statements
      expect(result).to.have.lengthOf(baseline.length + 1);
    });
  });

  // ── findScopeIdsMatchingSubmission → team_policy gate (SIMSBIOHUB-985) ──

  describe('findScopeIdsMatchingSubmission → team_policy gate', () => {
    // Edge case #9 from spec.md: anchor recomputation must not fire for scopes
    // outside the team-link set. The repository gates on a live team_policy so
    // orphaned scopes (no team granted) don't drive wasted anchor-compute jobs.

    it('should not return scopes for an approved policy with no team_policy', async () => {
      const submissionId = await createTestSubmission(connection);
      const baseline = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);

      const policyId = await createPolicy(connection, 'no-team-policy');
      const stmtId = await createPolicyStatement(connection, policyId, `urn:${submissionId}:*:*`);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, `urn:${submissionId}:*:*`);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      const scopeIds = result.map((r) => r.security_scope_id);

      expect(scopeIds).to.not.include(scopeId);
      expect(result).to.have.lengthOf(baseline.length);
    });

    it('should drop a scope from the result after its last team_policy is soft-deleted', async () => {
      const submissionId = await createTestSubmission(connection);

      const policyId = await createPolicy(connection, 'orphan-on-delete');
      const stmtId = await createPolicyStatement(connection, policyId, `urn:${submissionId}:*:*`);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, `urn:${submissionId}:*:*`);
      const teamId = await createTeam(connection, 'orphan-on-delete-team');
      const teamPolicyId = await createTeamPolicy(connection, teamId, policyId);

      // While the team_policy is live, the scope appears
      const before = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      expect(before.map((r) => r.security_scope_id)).to.include(scopeId);

      // After the only team_policy is soft-deleted, the scope is gated out
      await softDeleteTeamPolicy(teamPolicyId);
      const after = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      expect(after.map((r) => r.security_scope_id)).to.not.include(scopeId);
    });

    it('should keep a shared scope while any team_policy still references its policy', async () => {
      const submissionId = await createTestSubmission(connection);
      const urn = `urn:${submissionId}:*:*`;

      const policyId = await createPolicy(connection, 'shared-team-policies');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      const teamA = await createTeam(connection, 'shared-A');
      const teamB = await createTeam(connection, 'shared-B');
      const tpA = await createTeamPolicy(connection, teamA, policyId);
      await createTeamPolicy(connection, teamB, policyId);

      // Drop only one of the two links — the other still justifies the scope
      await softDeleteTeamPolicy(tpA);

      const result = await scopeRepo.findScopeIdsMatchingSubmission(submissionId);
      expect(result.map((r) => r.security_scope_id)).to.include(scopeId);
    });
  });

  // ── Keyset pagination → anchor computation correctness ──────────────

  describe('Keyset pagination → anchor computation correctness', () => {
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
      const root = await createTestFeature(connection, submissionId, 'survey', { name: 'Root' });
      const childA = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Child A' }, root);
      const childB = await createTestFeature(connection, submissionId, 'sample_site', { name: 'Child B' }, root);

      await secureFeature(connection, root);
      await secureFeature(connection, childA);
      await secureFeature(connection, childB);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'child-promotion-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

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

      // Service-level orchestration: deleteStaleAnchorBatch → resolveUrnForScope → computeAnchorBatch
      await refreshAnchorsViaService(scopeId);

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

    it('should delete all stale anchors across multiple keyset batches', async function () {
      // BATCH_SIZE in deleteStaleAnchorBatch is 5000. Creating 5001 flat features
      // (no parent → each is its own anchor) exercises multi-batch stale deletion:
      //
      // Setup: 5001 secured flat features → 5001 anchors.
      // Then unsecure all features → all 5001 anchors become stale.
      //
      // Batch 1 (IDs 1..5000): 5000 stale anchors identified and deleted.
      // Batch 2 (IDs 5001..5001): 1 stale anchor identified and deleted.
      // Batch 3: no more anchors → null → loop terminates.
      //
      // Final state: 0 anchors. If the keyset loop or boundary fallback is broken,
      // stale anchors survive or the loop hangs.
      this.timeout(120000);

      const submissionId = await createTestSubmission(connection);

      // Bulk-insert 5001 flat features (no parent → each becomes an anchor)
      const featureIds = await createTestFeaturesInBulk(connection, submissionId, 'survey', 5001);

      // Secure all features in bulk
      await secureFeaturesInBulk(featureIds);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'multi-batch-stale-delete-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

      // All 5001 flat features are anchors (no ancestor pruning for flat hierarchy)
      expect(await countAnchors(scopeId)).to.equal(5001);

      // Unsecure all features — every anchor becomes stale
      await connection.query(
        `UPDATE submission_feature_security
         SET record_end_date = now()
         WHERE submission_feature_id = ANY($1::INTEGER[])
           AND record_end_date IS NULL`,
        [featureIds]
      );

      // Run the paginated stale delete loop
      let staleLastId = 0;
      let batchCount = 0;

      while (true) {
        const staleBatch = await scopeRepo.deleteStaleAnchorBatch(scopeId, staleLastId);

        if (!staleBatch) {
          break;
        }

        staleLastId = staleBatch.pageLastId;
        batchCount++;
      }

      // All stale anchors deleted across multiple batches
      expect(await countAnchors(scopeId)).to.equal(0);

      // Must have taken more than 1 batch (5001 anchors / 5000 batch size)
      expect(batchCount).to.be.greaterThan(1);
    });

    it('should process all candidates across multiple keyset batches', async function () {
      // BATCH_SIZE in computeAnchorBatch is 5000. Creating a root + 5001
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
      const root = await createTestFeature(connection, submissionId, 'survey', { name: 'Root' });

      // Bulk-insert 5001 children under root — enough to span two keyset batches
      const childIds = await createTestFeaturesInBulk(connection, submissionId, 'sample_site', 5001, root);

      // Secure root + all children in bulk
      await secureFeaturesInBulk([root, ...childIds]);
      await rebuildClosureForSubmission(submissionId);

      const urn = `urn:${submissionId}:*:*`;
      const policyId = await createPolicy(connection, 'multi-batch-test');
      const stmtId = await createPolicyStatement(connection, policyId, urn);
      const scopeId = await setupScopeChain(scopeRepo, stmtId, urn);

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
