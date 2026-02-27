// Integration test for DownloadPipelineService — verifies multi-step download operations
// (create download, link features, status transitions, fragment planning) work
// correctly against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP403 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadFragmentRepository } from '../../repositories/download/download-fragment-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadService } from '../../services/download/download-service';

describe('DownloadPipelineService (integration)', function () {
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
   * Helper: insert a minimal submission and return its ID.
   * Uses the API user's system_user_id for foreign key references.
   */
  async function createTestSubmission(): Promise<number> {
    const systemUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO submission (uuid, system_user_id, source_system, name, description, comment, create_user)
      VALUES (gen_random_uuid(), ${systemUserId}, 'SIMS', 'Integration Test Submission', 'Test description', 'Test comment', ${systemUserId})
      RETURNING submission_id;
    `);

    return result.rows[0].submission_id;
  }

  /**
   * Helper: insert a submission_feature and return its ID.
   * Looks up feature_type by name from the pre-seeded feature_type table.
   */
  async function createTestFeature(
    submissionId: number,
    featureTypeName: string,
    data: Record<string, unknown>,
    parentFeatureId?: number
  ): Promise<number> {
    const systemUserId = connection.systemUserId();
    const dataJson = JSON.stringify(data);

    const uploadResult = await connection.sql(SQL`
      INSERT INTO upload (upload_status, record_end_date, create_user)
      VALUES ('completed', now(), ${systemUserId})
      RETURNING upload_id;
    `);
    const uploadId = uploadResult.rows[0].upload_id;

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, upload_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, create_user)
      VALUES (
        ${submissionId},
        ${uploadId},
        (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName} LIMIT 1),
        ${parentFeatureId ?? null},
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text) + 500,
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Helper: mark a submission feature as secured.
   * Uses security_rule_id 1 from seed data.
   */
  async function secureFeature(submissionFeatureId: number): Promise<void> {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO submission_feature_security (submission_feature_id, security_rule_id, create_user)
      VALUES (${submissionFeatureId}, 1, ${systemUserId});
    `);
  }

  describe('createDownloadRequest', () => {
    it('should create a download record and link submission features', async () => {
      // Step 1: Create a submission with two features
      const submissionId = await createTestSubmission();
      const featureId1 = await createTestFeature(submissionId, 'dataset', { name: 'Dataset A' });
      const featureId2 = await createTestFeature(submissionId, 'dataset', { name: 'Dataset B' });
      // Step 2: Create download request through the service (no team for test)
      const result = await service.createDownloadRequest(null, [featureId1, featureId2]);

      // Step 3: Verify download record was created with correct initial state
      const download = await crudService.findDownloadById(result.download_id);
      expect(download).to.not.be.null;
      expect(download!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(download!.team_id).to.be.null;
      expect(download!.total_fragments).to.equal(1);
      expect(download!.completed_fragments).to.equal(0);

      // Step 4: Verify both features were linked in download_feature table
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
      // Step 1: Snapshot count before the attempt
      const before = await connection.sql(SQL`SELECT COUNT(*)::int as count FROM download;`);
      const countBefore = before.rows[0].count;

      // Step 2: Use a savepoint so we can continue querying after the expected FK error
      // (PostgreSQL aborts the entire transaction on error without savepoints)
      await connection.query('SAVEPOINT before_fk_test');

      // Step 3: Attempt to link a non-existent submission_feature_id
      try {
        await service.createDownloadRequest(null, [999999]);
        expect.fail('Should have thrown a foreign key violation');
      } catch (error) {
        // Expected: FK constraint violation on download_feature.submission_feature_id
        expect(error).to.exist;
      }

      // Step 4: Restore to savepoint so the transaction is usable again
      await connection.query('ROLLBACK TO SAVEPOINT before_fk_test');

      // Step 5: Verify no orphan download record was created (count unchanged)
      const after = await connection.sql(SQL`SELECT COUNT(*)::int as count FROM download;`);
      const countAfter = after.rows[0].count;
      expect(countAfter).to.equal(countBefore);
    });
  });

  describe('updateDownloadStatus', () => {
    it('should set started_at only when transitioning to processing', async () => {
      // Step 1: Create a download
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Test' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      // Step 2: Transition to processing
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.PROCESSING);

      // Step 3: Verify started_at is set, completed_at is still null
      const afterProcessing = await crudService.findDownloadById(download_id);
      expect(afterProcessing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(afterProcessing!.started_at).to.not.be.null;
      expect(afterProcessing!.completed_at).to.be.null;

      const firstStartedAt = afterProcessing!.started_at;

      // Step 4: Transition to ready
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.READY);

      // Step 5: Verify started_at is preserved (not overwritten), completed_at is set
      const afterReady = await crudService.findDownloadById(download_id);
      expect(afterReady!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(afterReady!.started_at).to.equal(firstStartedAt);
      expect(afterReady!.completed_at).to.not.be.null;
    });
  });

  describe('full status lifecycle', () => {
    it('should transition pending → processing → ready and track all timestamps', async () => {
      // Step 1: Create a download with features
      const submissionId = await createTestSubmission();
      const featureId1 = await createTestFeature(submissionId, 'species_observation', {
        taxon_id: 180703,
        count: 35,
        timestamp: '2024-01-15T10:00:00Z'
      });
      const featureId2 = await createTestFeature(submissionId, 'species_observation', {
        taxon_id: 12345,
        count: 12,
        timestamp: '2024-01-16T14:30:00Z'
      });
      const { download_id } = await service.createDownloadRequest(null, [featureId1, featureId2]);

      // Step 2: Verify initial state
      const initial = await crudService.findDownloadById(download_id);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;
      expect(initial!.downloaded_at).to.be.null;

      // Step 3: Transition to processing and verify
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.PROCESSING);
      const processing = await crudService.findDownloadById(download_id);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;

      // Step 4: Transition to ready and verify
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.READY);
      const ready = await crudService.findDownloadById(download_id);
      expect(ready!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.completed_at).to.not.be.null;

      // Step 5: Verify download appears in user's download list with all timestamps
      const systemUserId = connection.systemUserId();
      const userDownloads = await crudService.getDownloadsByTeamMembership(systemUserId);
      const found = userDownloads.find((d) => d.download_id === download_id);
      expect(found).to.not.be.undefined;
      expect(found!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.started_at).to.not.be.null;
      expect(ready!.completed_at).to.not.be.null;
    });
  });

  describe('getDownloadFeatureSummaries', () => {
    it('should return per-feature estimated_byte_size from pre-computed column', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Size Test' });

      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      const sizeData = await crudService.getDownloadFeatureSummaries(download_id, null);

      expect(sizeData).to.have.length(1);
      expect(sizeData[0].submission_feature_id).to.equal(featureId);
      expect(sizeData[0].estimated_byte_size).to.be.a('string');
      expect(Number(sizeData[0].estimated_byte_size)).to.be.greaterThan(0);
      expect(sizeData[0].feature_type_name).to.equal('dataset');
      expect(sizeData[0]).to.not.have.property('data');
    });

    it('should apply authorization filtering to exclude secured features', async () => {
      const submissionId = await createTestSubmission();
      const openFeatureId = await createTestFeature(submissionId, 'dataset', { name: 'Open' });
      const securedFeatureId = await createTestFeature(submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeatureId);

      const { download_id } = await service.createDownloadRequest(null, [openFeatureId, securedFeatureId]);

      const sizeData = await crudService.getDownloadFeatureSummaries(download_id, null);

      expect(sizeData).to.have.length(1);
      expect(sizeData[0].submission_feature_id).to.equal(openFeatureId);
    });
  });

  describe('streamFragmentFeaturesByType (parent denormalization)', () => {
    it('should return parent_data and parent_feature_type_name for child features', async () => {
      // Step 1: Create parent-child feature hierarchy (dataset → species_observation)
      const submissionId = await createTestSubmission();
      const parentFeatureId = await createTestFeature(submissionId, 'dataset', {
        name: 'Test Dataset',
        description: 'Parent dataset for testing'
      });
      const childFeatureId = await createTestFeature(
        submissionId,
        'species_observation',
        { taxon_id: 180703, count: 5 },
        parentFeatureId
      );

      // Step 2: Create download and plan fragments
      const { download_id } = await service.createDownloadRequest(null, [childFeatureId]);
      const sizeEstimate = await service.estimateDownloadSize(download_id, null);
      await service.planFragments(download_id, sizeEstimate);

      // Step 3: Get fragment and stream features
      const fragments = await service.getFragmentsByDownloadId(download_id);
      expect(fragments).to.have.length(1);

      const fragmentRepo = new DownloadFragmentRepository(connection);
      const batches: unknown[][] = [];
      for await (const batch of fragmentRepo.streamFragmentFeaturesByType(
        fragments[0].download_fragment_id,
        'species_observation'
      )) {
        batches.push(batch);
      }

      // Step 4: Verify parent data is populated
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
      // Step 1: Create a root feature (no parent)
      const submissionId = await createTestSubmission();
      const rootFeatureId = await createTestFeature(submissionId, 'dataset', {
        name: 'Root Dataset'
      });

      // Step 2: Create download and plan fragments
      const { download_id } = await service.createDownloadRequest(null, [rootFeatureId]);
      const sizeEstimate = await service.estimateDownloadSize(download_id, null);
      await service.planFragments(download_id, sizeEstimate);

      // Step 3: Get fragment and stream features
      const fragments = await service.getFragmentsByDownloadId(download_id);
      const fragmentRepo = new DownloadFragmentRepository(connection);
      const batches: unknown[][] = [];
      for await (const batch of fragmentRepo.streamFragmentFeaturesByType(
        fragments[0].download_fragment_id,
        'dataset'
      )) {
        batches.push(batch);
      }

      // Step 4: Verify parent fields are null for root features
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
  async function addTeamMember(teamId: string, userId: number): Promise<void> {
    const apiUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO team_member (system_user_id, team_id, create_user)
      VALUES (${userId}, ${teamId}, ${apiUserId});
    `);
  }

  /**
   * Helper: create a data_request linked to a team.
   */
  async function createDataRequest(teamId: string, requestedBy: number): Promise<string> {
    const apiUserId = connection.systemUserId();

    const result = await connection.sql(SQL`
      INSERT INTO data_request (reason, team_id, requested_by, create_user)
      VALUES ('Integration test', ${teamId}, ${requestedBy}, ${apiUserId})
      RETURNING data_request_id;
    `);

    return result.rows[0].data_request_id;
  }

  /**
   * Helper: share a download with a user via download_share.
   */
  async function shareDownload(downloadId: string, userId: number): Promise<void> {
    await connection.sql(SQL`
      INSERT INTO download_share (download_id, system_user_id)
      VALUES (${downloadId}, ${userId})
      ON CONFLICT (download_id, system_user_id) DO NOTHING;
    `);
  }

  /**
   * Helper: create an anonymous download (system_user_id = NULL, team_id = NULL)
   * with a linked feature, returning the download_id.
   */
  async function createAnonymousDownload(): Promise<string> {
    const submissionId = await createTestSubmission();
    const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Anon' });
    const { download_id } = await service.createDownloadRequest(null, [featureId]);
    // createDownloadRequest sets system_user_id from connection.systemUserId(),
    // but the API user connection returns a real user id. Clear it for anonymous:
    await connection.sql(SQL`
      UPDATE download SET system_user_id = NULL WHERE download_id = ${download_id};
    `);
    return download_id;
  }

  // ── claimDownload ───────────────────────────────────────────────────

  describe('claimDownload', () => {
    it('should set system_user_id on an anonymous download', async () => {
      const downloadId = await createAnonymousDownload();

      // Verify it's anonymous
      const before = await crudService.findDownloadById(downloadId);
      expect(before!.system_user_id).to.be.null;
      expect(before!.team_id).to.be.null;

      // Claim it (service uses connection.systemUserId())
      await service.claimDownload(downloadId);

      // Verify system_user_id is now set
      const after = await crudService.findDownloadById(downloadId);
      expect(after!.system_user_id).to.equal(connection.systemUserId());
    });

    it('should fail when download is already claimed', async () => {
      const downloadId = await createAnonymousDownload();

      // First claim succeeds
      await service.claimDownload(downloadId);

      // Second claim fails (system_user_id is no longer NULL)
      try {
        await service.claimDownload(downloadId);
        expect.fail('Expected ApiConflictError');
      } catch (error) {
        expect((error as Error).message).to.equal('Unable to claim download');
      }
    });

    it('should fail for a data-request download (team_id set)', async () => {
      const otherUserId = await createOtherUser();
      const teamId = await createTeam('Claim Test Team');
      await addTeamMember(teamId, otherUserId);
      const dataRequestId = await createDataRequest(teamId, otherUserId);

      // Create a download with team_id set
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Secured' });
      const { download_id } = await service.createDownloadRequest(teamId, [featureId], dataRequestId);

      // Clear system_user_id but keep team_id
      await connection.sql(SQL`
        UPDATE download SET system_user_id = NULL WHERE download_id = ${download_id};
      `);

      // Claim should fail because team_id is set
      try {
        await service.claimDownload(download_id);
        expect.fail('Expected ApiConflictError');
      } catch (error) {
        expect((error as Error).message).to.equal('Unable to claim download');
      }
    });
  });

  // ── getAuthorizedDownload (3-path) ────────────────────────────

  describe('getAuthorizedDownload', () => {
    it('should authorize owner (system_user_id path)', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Owned' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      // API user is the owner (createDownloadRequest sets system_user_id)
      const apiUserId = connection.systemUserId();
      await service.getAuthorizedDownload(download_id, apiUserId);
      // No error thrown — authorized
    });

    it('should throw HTTP403 for wrong user (not owner, not shared, not team member)', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Owned' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      const otherUserId = await createOtherUser();
      try {
        await service.getAuthorizedDownload(download_id, otherUserId);
        expect.fail('Expected HTTP403');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });

    it('should authorize via download_share (shared path)', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Shared' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      // Share with another user
      const otherUserId = await createOtherUser();
      await shareDownload(download_id, otherUserId);

      await service.getAuthorizedDownload(download_id, otherUserId);
      // No error thrown — authorized
    });

    it('should authorize via data_request team membership (data request path)', async () => {
      const otherUserId = await createOtherUser();
      const teamId = await createTeam('Auth Test Team');
      await addTeamMember(teamId, otherUserId);
      const dataRequestId = await createDataRequest(teamId, otherUserId);

      // Create download linked to data request
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Request' });
      const { download_id } = await service.createDownloadRequest(teamId, [featureId], dataRequestId);

      await service.getAuthorizedDownload(download_id, otherUserId);
      // No error thrown — authorized
    });

    it('should throw HTTP403 for non-team-member on data request download', async () => {
      const teamMember = await createOtherUser();
      const outsider = await createOtherUser();
      const teamId = await createTeam('Exclusive Team');
      await addTeamMember(teamId, teamMember);
      const dataRequestId = await createDataRequest(teamId, teamMember);

      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Locked' });
      const { download_id } = await service.createDownloadRequest(teamId, [featureId], dataRequestId);

      try {
        await service.getAuthorizedDownload(download_id, outsider);
        expect.fail('Expected HTTP403');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });

  // ── getDownloadsByTeamMembership (3-path listing) ───────────────────

  describe('getDownloadsByTeamMembership', () => {
    it('should return owned downloads', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Mine' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      const apiUserId = connection.systemUserId();
      const downloads = await crudService.getDownloadsByTeamMembership(apiUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.include(download_id);
    });

    it('should return shared downloads', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Shared List' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      const otherUserId = await createOtherUser();
      await shareDownload(download_id, otherUserId);

      const downloads = await crudService.getDownloadsByTeamMembership(otherUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.include(download_id);
    });

    it('should return data request downloads via team membership', async () => {
      const otherUserId = await createOtherUser();
      const teamId = await createTeam('Listing Team');
      await addTeamMember(teamId, otherUserId);
      const dataRequestId = await createDataRequest(teamId, otherUserId);

      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Team DL' });
      const { download_id } = await service.createDownloadRequest(teamId, [featureId], dataRequestId);

      const downloads = await crudService.getDownloadsByTeamMembership(otherUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.include(download_id);
    });

    it('should not return downloads the user has no access to', async () => {
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Private' });
      const { download_id } = await service.createDownloadRequest(null, [featureId]);

      const otherUserId = await createOtherUser();
      const downloads = await crudService.getDownloadsByTeamMembership(otherUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.not.include(download_id);
    });
  });
});
