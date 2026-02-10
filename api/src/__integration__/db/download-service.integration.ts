// Integration test for DownloadService — verifies multi-step download operations
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
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadFragmentRepository } from '../../repositories/download-fragment-repository';
import { DownloadService } from '../../services/download-service';

describe('DownloadService (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: DownloadService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new DownloadService(connection);
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

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, feature_type_id, parent_submission_feature_id, data, data_byte_size, create_user)
      VALUES (
        ${submissionId},
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

  /**
   * Helper: create a policy that grants access to a feature URN, and assign it to the current user
   * via a team. Sets up the full chain: team → team_member, policy → policy_statement, team_policy.
   *
   * @param urn - The feature URN to grant access to (supports wildcards, e.g. 'urn:*:*:*').
   * @returns The policy_id for further assertions if needed.
   */
  async function grantAccessViaPolicy(urn: string): Promise<string> {
    const systemUserId = connection.systemUserId();

    // Create policy
    const policyResult = await connection.sql(SQL`
      INSERT INTO policy (name, description, create_user)
      VALUES (${'test-policy-' + Date.now()}, 'Integration test policy', ${systemUserId})
      RETURNING policy_id;
    `);
    const policyId = policyResult.rows[0].policy_id;

    // Create policy statement with the target URN
    await connection.sql(SQL`
      INSERT INTO policy_statement (policy_id, effect, submission_feature_urn, create_user)
      VALUES (${policyId}, 'allow', ${urn}, ${systemUserId});
    `);

    // Create team
    const teamResult = await connection.sql(SQL`
      INSERT INTO team (name, description, create_user)
      VALUES (${'test-team-' + Date.now()}, 'Integration test team', ${systemUserId})
      RETURNING team_id;
    `);
    const teamId = teamResult.rows[0].team_id;

    // Link team to policy
    await connection.sql(SQL`
      INSERT INTO team_policy (team_id, policy_id, create_user)
      VALUES (${teamId}, ${policyId}, ${systemUserId});
    `);

    // Add current user to team
    await connection.sql(SQL`
      INSERT INTO team_member (system_user_id, team_id, create_user)
      VALUES (${systemUserId}, ${teamId}, ${systemUserId});
    `);

    return policyId;
  }

  /**
   * Helper: look up the auto-generated URN for a submission feature.
   */
  async function getFeatureUrn(submissionFeatureId: number): Promise<string> {
    const result = await connection.sql(SQL`
      SELECT urn FROM submission_feature WHERE submission_feature_id = ${submissionFeatureId};
    `);
    return result.rows[0].urn;
  }

  describe('createDownloadRequest', () => {
    it('should create a download record and link submission features', async () => {
      // Step 1: Create a submission with two features
      const submissionId = await createTestSubmission();
      const featureId1 = await createTestFeature(submissionId, 'dataset', { name: 'Dataset A' });
      const featureId2 = await createTestFeature(submissionId, 'dataset', { name: 'Dataset B' });
      const systemUserId = connection.systemUserId();

      // Step 2: Create download request through the service
      const result = await service.createDownloadRequest(systemUserId, [featureId1, featureId2]);

      // Step 3: Verify download record was created with correct initial state
      expect(result).to.have.property('download_id').that.is.a('number');

      const download = await service.findDownloadById(result.download_id);
      expect(download).to.not.be.null;
      expect(download!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(download!.system_user_id).to.equal(systemUserId);
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
      const systemUserId = connection.systemUserId();

      // Step 1: Use a savepoint so we can continue querying after the expected FK error
      // (PostgreSQL aborts the entire transaction on error without savepoints)
      await connection.query('SAVEPOINT before_fk_test');

      // Step 2: Attempt to link a non-existent submission_feature_id
      try {
        await service.createDownloadRequest(systemUserId, [999999]);
        expect.fail('Should have thrown a foreign key violation');
      } catch (error) {
        // Expected: FK constraint violation on download_feature.submission_feature_id
        expect(error).to.exist;
      }

      // Step 3: Restore to savepoint so the transaction is usable again
      await connection.query('ROLLBACK TO SAVEPOINT before_fk_test');

      // Step 4: Verify no orphan download record was created
      const after = await connection.sql(SQL`SELECT COUNT(*)::int as count FROM download;`);
      const countAfter = after.rows[0].count;
      expect(countAfter).to.equal(0);
    });
  });

  describe('updateDownloadStatus', () => {
    it('should set started_at only when transitioning to processing', async () => {
      // Step 1: Create a download
      const submissionId = await createTestSubmission();
      const featureId = await createTestFeature(submissionId, 'dataset', { name: 'Test' });
      const systemUserId = connection.systemUserId();
      const { download_id } = await service.createDownloadRequest(systemUserId, [featureId]);

      // Step 2: Transition to processing
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.PROCESSING);

      // Step 3: Verify started_at is set, completed_at is still null
      const afterProcessing = await service.findDownloadById(download_id);
      expect(afterProcessing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(afterProcessing!.started_at).to.not.be.null;
      expect(afterProcessing!.completed_at).to.be.null;

      const firstStartedAt = afterProcessing!.started_at;

      // Step 4: Transition to ready
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.READY, {
        s3_key: 'downloads/test/test.zip',
        file_name: 'test.zip',
        file_size_bytes: 1024
      });

      // Step 5: Verify started_at is preserved (not overwritten), completed_at is set
      const afterReady = await service.findDownloadById(download_id);
      expect(afterReady!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(afterReady!.started_at).to.equal(firstStartedAt);
      expect(afterReady!.completed_at).to.not.be.null;
      expect(afterReady!.s3_key).to.equal('downloads/test/test.zip');
      expect(afterReady!.file_name).to.equal('test.zip');
      expect(afterReady!.file_size_bytes).to.equal('1024');
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
      const systemUserId = connection.systemUserId();
      const { download_id } = await service.createDownloadRequest(systemUserId, [featureId1, featureId2]);

      // Step 2: Verify initial state
      const initial = await service.findDownloadById(download_id);
      expect(initial!.download_status).to.equal(DownloadStatusEnum.PENDING);
      expect(initial!.started_at).to.be.null;
      expect(initial!.completed_at).to.be.null;
      expect(initial!.downloaded_at).to.be.null;

      // Step 3: Transition to processing and verify
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.PROCESSING);
      const processing = await service.findDownloadById(download_id);
      expect(processing!.download_status).to.equal(DownloadStatusEnum.PROCESSING);
      expect(processing!.started_at).to.not.be.null;

      // Step 4: Transition to ready and verify
      await service.updateDownloadStatus(download_id, DownloadStatusEnum.READY, {
        s3_key: `downloads/${download_id}/download-${download_id}.zip`,
        file_name: `download-${download_id}.zip`,
        file_size_bytes: 2048
      });
      const ready = await service.findDownloadById(download_id);
      expect(ready!.download_status).to.equal(DownloadStatusEnum.READY);
      expect(ready!.completed_at).to.not.be.null;
      expect(ready!.s3_key).to.equal(`downloads/${download_id}/download-${download_id}.zip`);

      // Step 5: Verify download appears in user's download list with all timestamps
      const userDownloads = await service.getDownloadsByUserId(systemUserId);
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

      const systemUserId = connection.systemUserId();
      const { download_id } = await service.createDownloadRequest(systemUserId, [featureId]);

      const sizeData = await service.getDownloadFeatureSummaries(download_id, systemUserId);

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

      const systemUserId = connection.systemUserId();
      const { download_id } = await service.createDownloadRequest(systemUserId, [openFeatureId, securedFeatureId]);

      const sizeData = await service.getDownloadFeatureSummaries(download_id, systemUserId);

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
      const systemUserId = connection.systemUserId();
      const { download_id } = await service.createDownloadRequest(systemUserId, [childFeatureId]);
      const sizeEstimate = await service.estimateDownloadSize(download_id, systemUserId);
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
      const systemUserId = connection.systemUserId();
      const { download_id } = await service.createDownloadRequest(systemUserId, [rootFeatureId]);
      const sizeEstimate = await service.estimateDownloadSize(download_id, systemUserId);
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
});
