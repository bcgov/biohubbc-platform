// Integration test for Download services — verifies multi-step download operations
// (create download, link features, status transitions, fragment planning, auth, claiming)
// work correctly against the real database.
//
// DownloadService = request-time operations (path handlers)
// DownloadPipelineService = background processing (pg-boss job handler only)
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadService } from '../../services/download/download-service';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

describe('Download services (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: DownloadPipelineService;
  let crudService: DownloadService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new DownloadPipelineService(connection);
    crudService = new DownloadService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: mark a submission feature as secured.
   * Uses security_rule_id 1 from seed data.
   * Optional effectiveDate allows testing future-dated security rules.
   */
  async function secureFeature(submissionFeatureId: number, effectiveDate?: string): Promise<void> {
    const systemUserId = connection.systemUserId();

    if (effectiveDate) {
      await connection.sql(SQL`
        INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, record_effective_date, create_user)
        VALUES (${submissionFeatureId}, 1, ${effectiveDate}::date, ${systemUserId});
      `);
    } else {
      await connection.sql(SQL`
        INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
        VALUES (${submissionFeatureId}, 1, ${systemUserId});
      `);
    }
  }

  /**
   * Helper: grant a team access to a specific feature via the RBAC chain.
   * Creates policy → policy_statement (allow) → team_policy.
   * The policy_statement trigger auto-decomposes the URN into indexed columns.
   */
  async function grantTeamAccess(
    teamId: string,
    submissionId: number,
    featureTypeName: string,
    featureId: number
  ): Promise<void> {
    const userId = connection.systemUserId();
    const urn = `urn:${submissionId}:${featureTypeName}:${featureId}`;

    const policy = await connection.sql(SQL`
      INSERT INTO policy (name, create_user)
      VALUES (${`test-policy-${Date.now()}`}, ${userId})
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
  }

  /**
   * Helper: grant a team access via a raw URN string (supports wildcards).
   * Default effect is 'allow'; pass 'deny' for deny-effect tests.
   */
  async function grantTeamAccessWithUrn(teamId: string, urn: string, effect: string = 'allow'): Promise<void> {
    const userId = connection.systemUserId();

    const policy = await connection.sql(SQL`
      INSERT INTO policy (name, create_user)
      VALUES (${`test-urn-policy-${crypto.randomUUID()}`}, ${userId})
      RETURNING policy_id;
    `);
    const policyId = policy.rows[0].policy_id;

    await connection.sql(SQL`
      INSERT INTO policy_statement (policy_id, effect, submission_feature_urn, create_user)
      VALUES (${policyId}, ${effect}, ${urn}, ${userId});
    `);

    await connection.sql(SQL`
      INSERT INTO team_policy (team_id, policy_id, create_user)
      VALUES (${teamId}, ${policyId}, ${userId});
    `);
  }

  describe('createDownloadRequest', () => {
    it('should create a download record and link submission features', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset A' });
      const featureId2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset B' });

      const result = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId1, featureId2]
      });

      const download = await crudService.findDownloadById(result.download_id);
      expect(download).to.not.be.null;
      expect(download!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(download!.total_fragments).to.equal(1);
      expect(download!.completed_fragments).to.equal(0);

      const features = await connection.sql(SQL`
        SELECT submission_feature_id FROM download_feature
        WHERE download_id = ${result.download_id}
        ORDER BY submission_feature_id;
      `);
      expect(features.rows).to.have.length(2);
      expect(features.rows.map((r: { submission_feature_id: number }) => r.submission_feature_id)).to.deep.equal([
        featureId1,
        featureId2
      ]);
    });

    it('should fail and not create a download when linking an invalid feature ID', async () => {
      const before = await connection.sql(SQL`SELECT COUNT(*)::int as count FROM download;`);
      const countBefore = before.rows[0].count;

      await connection.query('SAVEPOINT before_fk_test');

      try {
        await crudService.createDownloadRequest({ submissionFeatureIds: [999999] });
        expect.fail('Should have thrown a foreign key violation');
      } catch (error) {
        expect(error).to.exist;
      }

      await connection.query('ROLLBACK TO SAVEPOINT before_fk_test');

      const after = await connection.sql(SQL`SELECT COUNT(*)::int as count FROM download;`);
      const countAfter = after.rows[0].count;
      expect(countAfter).to.equal(countBefore);
    });
  });

  describe('updateDownloadStatus', () => {
    it('should set started_at only when transitioning to processing', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Test' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      await service.updateDownloadStatus(download_id, DownloadStatusEnum.PROCESSING);

      const afterProcessing = await crudService.findDownloadById(download_id);
      expect(afterProcessing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(afterProcessing!.started_at).to.not.be.null;
      expect(afterProcessing!.completed_at).to.be.null;

      const firstStartedAt = afterProcessing!.started_at;

      await service.updateDownloadStatus(download_id, DownloadStatusEnum.READY);

      const afterReady = await crudService.findDownloadById(download_id);
      expect(afterReady!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(afterReady!.started_at).to.equal(firstStartedAt);
      expect(afterReady!.completed_at).to.not.be.null;
    });
  });

  describe('full status lifecycle', () => {
    it('should transition pending -> processing -> ready and track all timestamps', async () => {
      const apiUserId = connection.systemUserId();
      const submissionId = await createTestSubmission(connection);
      const featureId1 = await createTestFeature(connection, submissionId, 'species_observation', {
        taxon_id: 180703,
        count: 35,
        timestamp: '2024-01-15T10:00:00Z'
      });
      const featureId2 = await createTestFeature(connection, submissionId, 'species_observation', {
        taxon_id: 12345,
        count: 12,
        timestamp: '2024-01-16T14:30:00Z'
      });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId1, featureId2]
      });

      // Link to a team so it appears in getDownloadsByTeamMembership
      await crudService.linkDownloadToNewTeam(
        download_id,
        apiUserId,
        'Test team for lifecycle',
        'Test team for lifecycle'
      );

      const initial = await crudService.findDownloadById(download_id);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;
      expect(initial!.downloaded_at).to.be.null;

      await service.updateDownloadStatus(download_id, DownloadStatusEnum.PROCESSING);
      const processing = await crudService.findDownloadById(download_id);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;

      await service.updateDownloadStatus(download_id, DownloadStatusEnum.READY);
      const ready = await crudService.findDownloadById(download_id);
      expect(ready!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.completed_at).to.not.be.null;

      // Step 5: Verify download appears in user's download list with all timestamps
      const systemUserId = connection.systemUserId();
      const { downloads: userDownloads } = await crudService.getDownloadsByTeamMembership(systemUserId);
      const found = userDownloads.find((d) => d.download_id === download_id);
      expect(found).to.not.be.undefined;
      expect(found!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.started_at).to.not.be.null;
      expect(ready!.completed_at).to.not.be.null;
    });
  });

  describe('getAuthorizedDownloadFeatures', () => {
    it('should return per-feature estimated_byte_size from pre-computed column', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Size Test' });

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const sizeData = await crudService.getAuthorizedDownloadFeatures(download_id);

      expect(sizeData).to.have.length(1);
      expect(sizeData[0].submission_feature_id).to.equal(featureId);
      expect(sizeData[0].estimated_byte_size).to.be.a('string');
      expect(Number(sizeData[0].estimated_byte_size)).to.be.greaterThan(0);
      expect(sizeData[0].feature_type_name).to.equal('dataset');
      expect(sizeData[0]).to.not.have.property('data');
    });

    it('should exclude secured features for anonymous downloads (no team)', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeatureId);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [openFeatureId, securedFeatureId]
      });

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);

      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeatureId);
    });

    it('should exclude secured features when team has no matching policy', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeatureId);

      await createTeam('No Policy Team');

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [openFeatureId, securedFeatureId]
      });

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);

      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeatureId);
    });

    it('should return empty when ALL features are secured and no policy exists (fail-closed)', async () => {
      // Critical safety test: if every feature in the download is secured and there is
      // no authorization, the result must be empty — not the full list.
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured A' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured B' });
      await secureFeature(feat1);
      await secureFeature(feat2);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat1, feat2]
      });

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);

      // Fail-closed: no features should be returned
      expect(result).to.have.length(0);
    });

    it('should block feature with future-dated security rule (fail-closed)', async () => {
      // Defense-in-depth: the secured CTE uses record_end_date IS NULL with NO
      // effective_date filter. A feature with a future-dated security rule is treated
      // as secured immediately — blocked until authorized. This errs on the side of safety.
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Future Secured' });
      await secureFeature(featureId, '2099-01-01');

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);

      // Feature is blocked — security rule exists (even though future-dated), no policy grant
      expect(result).to.have.length(0);
    });

    it('should include secured features when team has a matching ALLOW policy', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeatureId);

      const userId = connection.systemUserId();

      // Ownership team — linked to the download, no policies
      const ownershipTeamId = await createTeam('Ownership Team');
      await addTeamMember(ownershipTeamId, userId);

      // Policy team — has ALLOW policy, not linked to the download
      const policyTeamId = await createTeam('Policy Team');
      await addTeamMember(policyTeamId, userId);
      await grantTeamAccess(policyTeamId, submissionId, 'dataset', securedFeatureId);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [openFeatureId, securedFeatureId]
      });

      // Link the ownership team to the download (not the policy team)
      await crudService.createDownloadTeam(download_id, ownershipTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);

      // Both features should be returned: open (unsecured) + secured (user's policy team has ALLOW)
      expect(result).to.have.length(2);
      const featureIds = result.map((f) => f.submission_feature_id);
      expect(featureIds).to.include(openFeatureId);
      expect(featureIds).to.include(securedFeatureId);
    });

    // ── Wildcard URN policies ───────────────────────────────────────────

    it('should grant access with wildcard feature_id (urn:subId:type:*)', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'A' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'B' });
      await secureFeature(feat1);
      await secureFeature(feat2);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('WC-FeatId Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('WC-FeatId Policy');
      await addTeamMember(policyTeamId, userId);
      await grantTeamAccessWithUrn(policyTeamId, `urn:${submissionId}:dataset:*`);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat1, feat2]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(2);
    });

    it('should grant access with wildcard feature_type and feature_id (urn:subId:*:*)', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'DS' });
      const feat2 = await createTestFeature(connection, submissionId, 'species_observation', { taxon_id: 1 });
      await secureFeature(feat1);
      await secureFeature(feat2);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('WC-TypeId Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('WC-TypeId Policy');
      await addTeamMember(policyTeamId, userId);
      await grantTeamAccessWithUrn(policyTeamId, `urn:${submissionId}:*:*`);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat1, feat2]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(2);
    });

    it('should grant access with full wildcard (urn:*:*:*)', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat = await createTestFeature(connection, submissionId, 'dataset', { name: 'X' });
      await secureFeature(feat);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('WC-Full Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('WC-Full Policy');
      await addTeamMember(policyTeamId, userId);
      await grantTeamAccessWithUrn(policyTeamId, 'urn:*:*:*');

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
    });

    // ── Soft-deleted auth chain (fail-closed) ──────────────────────────
    //
    // Each test sets up a complete working auth chain (secured feature + ALLOW policy),
    // then soft-deletes ONE link. The secured feature must be excluded — proving
    // every record_end_date IS NULL check is load-bearing.

    /**
     * Helper: set up a complete authorized download chain.
     * Returns all IDs needed to soft-delete any single link.
     */
    async function setupAuthorizedSecuredDownload() {
      const submissionId = await createTestSubmission(connection);
      const openFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeat);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam(`SD-Owner-${Date.now()}`);
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam(`SD-Policy-${Date.now()}`);
      await addTeamMember(policyTeamId, userId);
      await grantTeamAccess(policyTeamId, submissionId, 'dataset', securedFeat);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [openFeat, securedFeat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      return { submissionId, openFeat, securedFeat, userId, ownerTeamId, policyTeamId, download_id };
    }

    it('should exclude secured feature when download_team is soft-deleted', async () => {
      const { download_id, ownerTeamId, openFeat } = await setupAuthorizedSecuredDownload();

      await connection.sql(SQL`
        UPDATE download_team SET record_end_date = now()
        WHERE download_id = ${download_id} AND team_id = ${ownerTeamId};
      `);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeat);
    });

    it('should exclude secured feature when team_member on download team is soft-deleted', async () => {
      const { download_id, ownerTeamId, userId, openFeat } = await setupAuthorizedSecuredDownload();

      await connection.sql(SQL`
        UPDATE team_member SET record_end_date = now()
        WHERE team_id = ${ownerTeamId} AND system_user_id = ${userId};
      `);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeat);
    });

    it('should exclude secured feature when team_member on policy team is soft-deleted', async () => {
      const { download_id, policyTeamId, userId, openFeat } = await setupAuthorizedSecuredDownload();

      await connection.sql(SQL`
        UPDATE team_member SET record_end_date = now()
        WHERE team_id = ${policyTeamId} AND system_user_id = ${userId};
      `);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeat);
    });

    it('should exclude secured feature when team_policy is soft-deleted', async () => {
      const { download_id, policyTeamId, openFeat } = await setupAuthorizedSecuredDownload();

      await connection.sql(SQL`
        UPDATE team_policy SET record_end_date = now()
        WHERE team_id = ${policyTeamId};
      `);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeat);
    });

    it('should exclude secured feature when policy_statement is soft-deleted', async () => {
      const { download_id, openFeat } = await setupAuthorizedSecuredDownload();

      // Soft-delete ALL policy statements in this transaction (test isolation guarantees
      // only our test's statements exist)
      await connection.sql(SQL`
        UPDATE policy_statement SET record_end_date = now()
        WHERE record_end_date IS NULL AND effect = 'allow';
      `);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(openFeat);
    });

    // ── Security rule lifecycle ─────────────────────────────────────────

    it('should treat feature as unsecured when security rule is soft-deleted', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Was Secured' });
      await secureFeature(feat);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat]
      });

      // Blocked while security rule is active
      const blocked = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(blocked).to.have.length(0);

      // Soft-delete the security rule
      await connection.sql(SQL`
        UPDATE submission_feature_security SET record_end_date = now()
        WHERE submission_feature_id = ${feat};
      `);

      // Feature is now unsecured — returned via PATH 1 without any policy
      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(1);
      expect(result[0].submission_feature_id).to.equal(feat);
    });

    // ── Wrong-target policies (no cross-leak) ──────────────────────────

    it('should not grant access when policy targets wrong submission_id', async () => {
      const subA = await createTestSubmission(connection);
      const subB = await createTestSubmission(connection);
      const feat = await createTestFeature(connection, subA, 'dataset', { name: 'In Sub A' });
      await secureFeature(feat);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('WrongSub Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('WrongSub Policy');
      await addTeamMember(policyTeamId, userId);
      // Policy targets subB — should NOT grant access to subA's feature
      await grantTeamAccessWithUrn(policyTeamId, `urn:${subB}:dataset:*`);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(0);
    });

    it('should not grant access when policy targets wrong feature_type', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat = await createTestFeature(connection, submissionId, 'dataset', { name: 'DS' });
      await secureFeature(feat);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('WrongType Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('WrongType Policy');
      await addTeamMember(policyTeamId, userId);
      // Policy targets species_observation — should NOT grant access to dataset feature
      await grantTeamAccessWithUrn(policyTeamId, `urn:${submissionId}:species_observation:*`);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [feat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(0);
    });

    it('should not grant access when policy targets wrong feature_id', async () => {
      const submissionId = await createTestSubmission(connection);
      const targetFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Target' });
      const decoyFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Decoy' });
      await secureFeature(targetFeat);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('WrongId Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('WrongId Policy');
      await addTeamMember(policyTeamId, userId);
      // Policy targets decoyFeat — should NOT grant access to targetFeat
      await grantTeamAccess(policyTeamId, submissionId, 'dataset', decoyFeat);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [targetFeat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(0);
    });

    // ── Cross-isolation ─────────────────────────────────────────────────

    it('should not leak features across different downloads', async () => {
      const submissionId = await createTestSubmission(connection);
      const featA = await createTestFeature(connection, submissionId, 'dataset', { name: 'DL-A Feature' });
      const featB = await createTestFeature(connection, submissionId, 'dataset', { name: 'DL-B Feature' });

      const dlA = await crudService.createDownloadRequest({ submissionFeatureIds: [featA] });
      const dlB = await crudService.createDownloadRequest({ submissionFeatureIds: [featB] });

      const resultA = await crudService.getAuthorizedDownloadFeatures(dlA.download_id);
      expect(resultA).to.have.length(1);
      expect(resultA[0].submission_feature_id).to.equal(featA);

      const resultB = await crudService.getAuthorizedDownloadFeatures(dlB.download_id);
      expect(resultB).to.have.length(1);
      expect(resultB[0].submission_feature_id).to.equal(featB);
    });

    it('should not grant access via another user who has policy but is not on the download team', async () => {
      // User A is on the download team but has NO policy.
      // User B has the ALLOW policy but is NOT on the download team.
      // The SQL chain requires the SAME user to be on both teams — User B's policy
      // should not leak through.
      const submissionId = await createTestSubmission(connection);
      const securedFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeat);

      const userA = connection.systemUserId();
      const userB = await createOtherUser();

      // User A's team — linked to the download, no policies
      const ownerTeamId = await createTeam('CrossUser Owner');
      await addTeamMember(ownerTeamId, userA);

      // User B's policy team — has ALLOW, NOT linked to the download
      const policyTeamId = await createTeam('CrossUser Policy');
      await addTeamMember(policyTeamId, userB);
      await grantTeamAccess(policyTeamId, submissionId, 'dataset', securedFeat);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [securedFeat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      // User B has policy but isn't on the download team — secured feature must be excluded
      expect(result).to.have.length(0);
    });

    // ── Deny effect ────────────────────────────────────────────────────

    it('should not grant access with deny-only policy (only ALLOW authorizes)', async () => {
      const submissionId = await createTestSubmission(connection);
      const securedFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Denied' });
      await secureFeature(securedFeat);

      const userId = connection.systemUserId();
      const ownerTeamId = await createTeam('Deny Owner');
      await addTeamMember(ownerTeamId, userId);
      const policyTeamId = await createTeam('Deny Policy');
      await addTeamMember(policyTeamId, userId);
      // Deny effect — should NOT satisfy the ps.effect = 'allow' condition
      await grantTeamAccessWithUrn(policyTeamId, `urn:${submissionId}:dataset:${securedFeat}`, 'deny');

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [securedFeat]
      });
      await crudService.createDownloadTeam(download_id, ownerTeamId);

      const result = await crudService.getAuthorizedDownloadFeatures(download_id);
      expect(result).to.have.length(0);
    });
  });

  describe('streamFragmentFeaturesByType (parent denormalization)', () => {
    it('should return parent_data and parent_feature_type_name for child features', async () => {
      const submissionId = await createTestSubmission(connection);
      const parentFeatureId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Test Dataset',
        description: 'Parent dataset for testing'
      });
      const childFeatureId = await createTestFeature(
        connection,
        submissionId,
        'species_observation',
        { taxon_id: 180703, count: 5 },
        parentFeatureId
      );

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [childFeatureId]
      });
      const sizeEstimate = await service.estimateDownloadSize(download_id);
      await service.planFragments(download_id, sizeEstimate);

      const fragments = await crudService.getFragmentsByDownloadId(download_id);
      expect(fragments).to.have.length(1);

      const fragmentRepo = new DownloadFragmentRepository(connection);
      const batches: unknown[][] = [];
      for await (const batch of fragmentRepo.streamFragmentFeaturesByType(
        fragments[0].download_fragment_id,
        'species_observation'
      )) {
        batches.push(batch);
      }

      expect(batches).to.have.length(1);
      expect(batches[0]).to.have.length(1);

      const feature = batches[0][0] as {
        submission_feature_id: number;
        parent_data: Record<string, unknown> | null;
        parent_feature_type_name: string | null;
      };
      expect(feature.submission_feature_id).to.equal(childFeatureId);
      expect(feature.parent_feature_type_name).to.equal('dataset');
      expect(feature.parent_data).to.not.be.null;
      expect(feature.parent_data!.name).to.equal('Test Dataset');
    });

    it('should return null parent fields for root features (no parent)', async () => {
      const submissionId = await createTestSubmission(connection);
      const rootFeatureId = await createTestFeature(connection, submissionId, 'dataset', {
        name: 'Root Dataset'
      });

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [rootFeatureId]
      });
      const sizeEstimate = await service.estimateDownloadSize(download_id);
      await service.planFragments(download_id, sizeEstimate);

      const fragments = await crudService.getFragmentsByDownloadId(download_id);
      const fragmentRepo = new DownloadFragmentRepository(connection);
      const batches: unknown[][] = [];
      for await (const batch of fragmentRepo.streamFragmentFeaturesByType(
        fragments[0].download_fragment_id,
        'dataset'
      )) {
        batches.push(batch);
      }

      expect(batches).to.have.length(1);
      const feature = batches[0][0] as {
        submission_feature_id: number;
        parent_data: Record<string, unknown> | null;
        parent_feature_type_name: string | null;
      };
      expect(feature.submission_feature_id).to.equal(rootFeatureId);
      expect(feature.parent_feature_type_name).to.be.null;
      expect(feature.parent_data).to.be.null;
    });
  });

  // ── Helpers for ownership / auth integration tests ──────────────────

  /**
   * Helper: create a second system_user for "other user" scenarios.
   * Returns the new system_user_id.
   */
  let _userSeq = 0;
  async function createOtherUser(): Promise<number> {
    const apiUserId = connection.systemUserId();
    const guid = `test-other-${Date.now()}-${++_userSeq}`;

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
   * Helper: create a team and return its UUID.
   */
  async function createTeam(name: string): Promise<string> {
    const apiUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO team (name, create_user)
      VALUES (${name}, ${apiUserId})
      RETURNING team_id;
    `);

    return result.rows[0].team_id;
  }

  /**
   * Helper: add a user to a team.
   */
  async function addTeamMember(teamId: string, systemUserId: number): Promise<void> {
    const apiUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO team_member (team_id, system_user_id, create_user)
      VALUES (${teamId}, ${systemUserId}, ${apiUserId});
    `);
  }

  /**
   * Helper: create an anonymous download (no team association).
   * The UUID is the only credential — anyone with the link can access it.
   */
  async function createAnonymousDownload(): Promise<string> {
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Anon' });
    const { download_id } = await crudService.createDownloadRequest({
      submissionFeatureIds: [featureId]
    });
    return download_id;
  }

  // ── claimDownload ───────────────────────────────────────────────────

  describe('claimDownload', () => {
    it('should create team association for an anonymous download', async () => {
      const downloadId = await createAnonymousDownload();
      const systemUserId = connection.systemUserId();

      // Before claim: anonymous access works (no team rows -> UUID is the credential)
      await crudService.getAuthorizedDownload(downloadId, null);

      // Claim creates team + download_team link
      await crudService.claimDownload(downloadId, systemUserId);

      // After claim: team member can access
      await crudService.getAuthorizedDownload(downloadId, systemUserId);
    });

    it('should fail when download is already claimed', async () => {
      const downloadId = await createAnonymousDownload();
      const systemUserId = connection.systemUserId();

      await crudService.claimDownload(downloadId, systemUserId);

      try {
        await crudService.claimDownload(downloadId, systemUserId);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTP409).message).to.equal('Download already claimed');
      }
    });

    it('should fail when download already has team associations', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Team DL' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const systemUserId = connection.systemUserId();
      // Link to a team (simulates authenticated download creation)
      await crudService.linkDownloadToNewTeam(download_id, systemUserId, 'Original team', 'Original team');

      // Claim should fail because download_team rows already exist
      const otherUserId = await createOtherUser();
      try {
        await crudService.claimDownload(download_id, otherUserId);
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTP409).message).to.equal('Download already claimed');
      }
    });
  });

  // ── getAuthorizedDownload (team-based) ────────────────────────────

  describe('getAuthorizedDownload', () => {
    it('should allow access to anonymous download (no team associations)', async () => {
      const downloadId = await createAnonymousDownload();

      // Anyone can access — no download_team rows means UUID is the credential
      const download = await crudService.getAuthorizedDownload(downloadId, null);
      expect(download.download_id).to.equal(downloadId);
    });

    it('should authorize team member on team-linked download', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Team DL' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const systemUserId = connection.systemUserId();
      await crudService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth test team', 'Auth test team');

      const download = await crudService.getAuthorizedDownload(download_id, systemUserId);
      expect(download.download_id).to.equal(download_id);
    });

    it('should throw HTTP403 for non-team-member on team-linked download', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Locked' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const systemUserId = connection.systemUserId();
      await crudService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth test team', 'Auth test team');

      const outsider = await createOtherUser();
      try {
        await crudService.getAuthorizedDownload(download_id, outsider);
        expect.fail('Expected HTTP403');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });

    it('should throw HTTP403 for unauthenticated access to team-linked download', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Locked' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const systemUserId = connection.systemUserId();
      await crudService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth test team', 'Auth test team');

      try {
        await crudService.getAuthorizedDownload(download_id, null);
        expect.fail('Expected HTTP403');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });

  // ── getDownloadsByTeamMembership ───────────────────────────────────

  describe('getDownloadsByTeamMembership', () => {
    it('should return downloads linked via team membership', async () => {
      const apiUserId = connection.systemUserId();
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Mine' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      await crudService.linkDownloadToNewTeam(download_id, apiUserId, 'Listing test team', 'Listing test team');

      const { downloads } = await crudService.getDownloadsByTeamMembership(apiUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.include(download_id);
    });

    it('should not return downloads the user has no team membership for', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Private' });
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      // Anonymous download (no team link) should not appear in team-based listing
      const otherUserId = await createOtherUser();
      const { downloads } = await crudService.getDownloadsByTeamMembership(otherUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.not.include(download_id);
    });
  });
});
