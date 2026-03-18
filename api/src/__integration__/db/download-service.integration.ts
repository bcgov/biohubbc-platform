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

  describe('getDownloadFeatures', () => {
    it('should return per-feature estimated_byte_size from pre-computed column', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Size Test' });

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [featureId]
      });

      const sizeData = await crudService.getDownloadFeatures(download_id);

      expect(sizeData).to.have.length(1);
      expect(sizeData[0].submission_feature_id).to.equal(featureId);
      expect(sizeData[0].estimated_byte_size).to.be.a('string');
      expect(Number(sizeData[0].estimated_byte_size)).to.be.greaterThan(0);
      expect(sizeData[0].feature_type_name).to.equal('dataset');
      expect(sizeData[0]).to.not.have.property('data');
    });

    it('should return all linked features regardless of security status', async () => {
      // Authorization is enforced at creation time via filterAuthorizedFeatureIds.
      // At retrieval time, getDownloadFeatures returns everything that was linked.
      const submissionId = await createTestSubmission(connection);
      const openFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeatureId);

      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: [openFeatureId, securedFeatureId]
      });

      const result = await crudService.getDownloadFeatures(download_id);

      expect(result).to.have.length(2);
      const featureIds = result.map((f: { submission_feature_id: number }) => f.submission_feature_id);
      expect(featureIds).to.include(openFeatureId);
      expect(featureIds).to.include(securedFeatureId);
    });

    it('should not leak features across different downloads', async () => {
      const submissionId = await createTestSubmission(connection);
      const featA = await createTestFeature(connection, submissionId, 'dataset', { name: 'DL-A Feature' });
      const featB = await createTestFeature(connection, submissionId, 'dataset', { name: 'DL-B Feature' });

      const dlA = await crudService.createDownloadRequest({ submissionFeatureIds: [featA] });
      const dlB = await crudService.createDownloadRequest({ submissionFeatureIds: [featB] });

      const resultA = await crudService.getDownloadFeatures(dlA.download_id);
      expect(resultA).to.have.length(1);
      expect(resultA[0].submission_feature_id).to.equal(featA);

      const resultB = await crudService.getDownloadFeatures(dlB.download_id);
      expect(resultB).to.have.length(1);
      expect(resultB[0].submission_feature_id).to.equal(featB);
    });

    it('should return empty for a download with no linked features', async () => {
      const { download_id } = await crudService.createDownloadRequest({
        submissionFeatureIds: []
      });

      const result = await crudService.getDownloadFeatures(download_id);

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

  // ── filterAuthorizedFeatureIds (creation-time auth) ────────────────

  describe('filterAuthorizedFeatureIds', () => {
    it('should include secured features when user has matching ALLOW policy via team membership', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeat);

      const userId = connection.systemUserId();
      const policyTeamId = await createTeam('CreationAuth Policy');
      await addTeamMember(policyTeamId, userId);
      await grantTeamAccess(policyTeamId, submissionId, 'dataset', securedFeat);

      const result = await crudService.filterAuthorizedFeatureIds([openFeat, securedFeat], userId);

      expect(result).to.have.length(2);
      expect(result).to.include(openFeat);
      expect(result).to.include(securedFeat);
    });

    it('should exclude secured features when user has no matching policy', async () => {
      const submissionId = await createTestSubmission(connection);
      const openFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeat);

      const userId = connection.systemUserId();

      const result = await crudService.filterAuthorizedFeatureIds([openFeat, securedFeat], userId);

      expect(result).to.have.length(1);
      expect(result).to.include(openFeat);
      expect(result).to.not.include(securedFeat);
    });
  });
});
