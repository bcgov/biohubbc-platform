// Integration test for Download services — verifies multi-step download operations
// (create download, cart/filter feature resolution, status transitions, fragment planning, auth, claiming)
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
import { DownloadRepository } from '../../repositories/download/download-repository';
import { CartService } from '../../services/cart-service';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadService } from '../../services/download/download-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

describe('Download services (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: DownloadPipelineService;
  let crudService: DownloadService;
  let cartService: CartService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new DownloadPipelineService(connection);
    crudService = new DownloadService(connection);
    cartService = new CartService(connection);
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
   * Helper: create a cart-backed download for the given feature IDs.
   * Creates a cart via CartService, then creates a download with the cart_id FK.
   * Returns { download_id } to match the shape callers expect.
   */
  async function createCartDownload(
    featureIds: number[],
    fragmentSizeBytes?: number
  ): Promise<{ download_id: string }> {
    const systemUserId = connection.systemUserId();
    const cartResponse = await cartService.createCart(systemUserId, featureIds);
    return crudService.createDownload({
      cartId: cartResponse.cart.cart_id,
      fragmentSizeBytes,
      format: 'csv'
    });
  }

  describe('createDownload', () => {
    it('should create a cart-based download with cart_id set and filters null', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset A' });
      const featureId2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Dataset B' });

      const result = await createCartDownload([featureId1, featureId2]);

      const download = await crudService.findDownloadById(result.download_id);
      expect(download).to.not.be.null;
      expect(download!.download_status).to.equal(DownloadStatusEnum.PENDING);

      // Verify cart_id is set and filters is null
      const row = await connection.sql(SQL`
        SELECT cart_id, filters FROM download WHERE download_id = ${result.download_id};
      `);
      expect(row.rows[0].cart_id).to.not.be.null;
      expect(row.rows[0].filters).to.be.null;
    });

    it('should create a filter-based download with filters set and cart_id null', async () => {
      const filters = { keyword: 'test-keyword' };
      const result = await crudService.createDownload({ filters, format: 'csv' });

      const row = await connection.sql(SQL`
        SELECT cart_id, filters FROM download WHERE download_id = ${result.download_id};
      `);
      expect(row.rows[0].cart_id).to.be.null;
      expect(row.rows[0].filters).to.not.be.null;
      expect(row.rows[0].filters.keyword).to.equal('test-keyword');
    });

    it('should reject download with both cart_id and filters NULL (CHECK constraint)', async () => {
      // The CHECK constraint on download requires: cart_id IS NOT NULL OR filters IS NOT NULL.
      // Bypass the service layer and insert directly to test the constraint.
      try {
        await connection.sql(SQL`
          INSERT INTO download (download_status, fragment_size_bytes, cart_id, filters, format, create_user)
          VALUES ('pending', 524288000, NULL, NULL, 'csv', ${connection.systemUserId()});
        `);
        expect.fail('Expected CHECK constraint violation');
      } catch (error: any) {
        // PG error is wrapped by ApiExecuteSQLError — original error in errors[]
        const pgMessage = error.errors?.[0]?.message ?? error.message ?? '';
        expect(pgMessage).to.include('download_feature_source_check');
      }
    });
  });

  describe('createDownload artifact integration', () => {
    it('should create a pending artifact and download_artifact link for cart-based download', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Artifact Test' });

      const { download_id } = await createCartDownload([featureId]);

      // Verify download_artifact row exists linking download to an artifact
      const daRows = await connection.sql(SQL`
        SELECT da.download_id, da.artifact_id
        FROM download_artifact da
        WHERE da.download_id = ${download_id}
          AND da.record_end_date IS NULL;
      `);
      expect(daRows.rowCount).to.equal(1);

      // Verify format is on the download record, not the join table
      const dlRows = await connection.sql(SQL`
        SELECT format FROM download WHERE download_id = ${download_id};
      `);
      expect(dlRows.rows[0].format).to.equal('csv');

      // Verify the linked artifact exists with correct status and key pattern
      const artifactRows = await connection.sql(SQL`
        SELECT a.artifact_status, a.object_key, a.bucket, a.format
        FROM artifact a
        JOIN download_artifact da ON da.artifact_id = a.artifact_id
        WHERE da.download_id = ${download_id}
          AND da.record_end_date IS NULL;
      `);
      expect(artifactRows.rowCount).to.equal(1);
      expect(artifactRows.rows[0].artifact_status).to.equal('pending');
      expect(artifactRows.rows[0].object_key).to.match(
        new RegExp(`^downloads/${download_id}/download-\\d{4}-\\d{2}-\\d{2}T\\d{6}Z\\.csv$`)
      );
      expect(artifactRows.rows[0].bucket).to.not.be.empty;
      expect(artifactRows.rows[0].format).to.equal('csv');

      // download.format (requested) matches artifact.format (actual) for new downloads
      expect(dlRows.rows[0].format).to.equal(artifactRows.rows[0].format);
    });

    it('should create a pending artifact for filter-based download', async () => {
      const filters = { keyword: 'artifact-filter-test' };
      const { download_id } = await crudService.createDownload({ filters, format: 'csv' });

      const daRows = await connection.sql(SQL`
        SELECT da.download_id, da.artifact_id
        FROM download_artifact da
        WHERE da.download_id = ${download_id}
          AND da.record_end_date IS NULL;
      `);
      expect(daRows.rowCount).to.equal(1);

      const artifactRows = await connection.sql(SQL`
        SELECT a.artifact_status, a.object_key, a.format
        FROM artifact a
        WHERE a.artifact_id = ${daRows.rows[0].artifact_id};
      `);
      expect(artifactRows.rows[0].artifact_status).to.equal('pending');
      expect(artifactRows.rows[0].object_key).to.match(
        new RegExp(`^downloads/${download_id}/download-\\d{4}-\\d{2}-\\d{2}T\\d{6}Z\\.csv$`)
      );
      expect(artifactRows.rows[0].format).to.equal('csv');
    });

    it('should rollback artifact and download_artifact when transaction is rolled back', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Rollback Test' });

      const { download_id } = await createCartDownload([featureId]);

      // Verify rows exist before rollback
      const beforeRows = await connection.sql(SQL`
        SELECT 1 FROM download_artifact WHERE download_id = ${download_id} AND record_end_date IS NULL;
      `);
      expect(beforeRows.rowCount).to.equal(1);

      // Rollback and get a fresh connection
      await connection.rollback();
      connection.release();

      connection = getAPIUserDBConnection();
      await connection.open();
      crudService = new DownloadService(connection);

      // Verify rows are gone after rollback
      const afterRows = await connection.sql(SQL`
        SELECT 1 FROM download_artifact WHERE download_id = ${download_id} AND record_end_date IS NULL;
      `);
      expect(afterRows.rowCount).to.equal(0);

      // Verify artifact is also rolled back — join through download_artifact
      // to find the artifact by download_id (object_key includes a timestamp
      // so we can't reconstruct it from here)
      const afterArtifact = await connection.sql(SQL`
        SELECT 1 FROM artifact a
        JOIN download_artifact da ON da.artifact_id = a.artifact_id
        WHERE da.download_id = ${download_id};
      `);
      expect(afterArtifact.rowCount).to.equal(0);
    });
  });

  describe('updateDownloadStatus', () => {
    it('should set started_at only when transitioning to processing', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Test' });
      const { download_id } = await createCartDownload([featureId]);

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
      const { download_id } = await createCartDownload([featureId1, featureId2]);

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
    it('should resolve cart-based features with estimated_byte_size from pre-computed column', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Size Test' });

      const { download_id } = await createCartDownload([featureId]);

      const sizeData = await crudService.getDownloadFeatures(download_id);

      expect(sizeData).to.have.length(1);
      expect(sizeData[0].submission_feature_id).to.equal(featureId);
      expect(sizeData[0].estimated_byte_size).to.be.a('string');
      expect(Number(sizeData[0].estimated_byte_size)).to.be.greaterThan(0);
      expect(sizeData[0].feature_type_name).to.equal('dataset');
      expect(sizeData[0]).to.not.have.property('data');
    });

    it('should return all cart features regardless of security status', async () => {
      // Cart downloads are frozen at checkout — security was enforced when the
      // user added features to the cart. At resolution time, getDownloadFeatures
      // returns everything in cart_submission_feature for the download's cart.
      //
      // Use raw SQL to insert cart_submission_feature rows because CartService
      // filters out secured features during addSubmissionFeaturesToCart.
      const systemUserId = connection.systemUserId();
      const submissionId = await createTestSubmission(connection);
      const openFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Open' });
      const securedFeatureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Secured' });
      await secureFeature(securedFeatureId);

      // Create cart directly (bypasses CartService security filtering)
      const cartResult = await connection.sql(SQL`
        INSERT INTO cart (system_user_id, cart_status, create_user)
        VALUES (${systemUserId}, 'active', ${systemUserId})
        RETURNING cart_id;
      `);
      const cartId = cartResult.rows[0].cart_id;
      await connection.sql(SQL`
        INSERT INTO cart_submission_feature (cart_id, submission_feature_id, create_user)
        VALUES (${cartId}, ${openFeatureId}, ${systemUserId}), (${cartId}, ${securedFeatureId}, ${systemUserId});
      `);

      const { download_id } = await crudService.createDownload({ cartId, format: 'csv' });

      const result = await crudService.getDownloadFeatures(download_id);

      expect(result).to.have.length(2);
      const featureIds = result.map((f: { submission_feature_id: number }) => f.submission_feature_id);
      expect(featureIds).to.include(openFeatureId);
      expect(featureIds).to.include(securedFeatureId);
    });

    it('should not leak features across different cart-based downloads', async () => {
      const submissionId = await createTestSubmission(connection);
      const featA = await createTestFeature(connection, submissionId, 'dataset', { name: 'DL-A Feature' });
      const featB = await createTestFeature(connection, submissionId, 'dataset', { name: 'DL-B Feature' });

      const dlA = await createCartDownload([featA]);
      const dlB = await createCartDownload([featB]);

      const resultA = await crudService.getDownloadFeatures(dlA.download_id);
      expect(resultA).to.have.length(1);
      expect(resultA[0].submission_feature_id).to.equal(featA);

      const resultB = await crudService.getDownloadFeatures(dlB.download_id);
      expect(resultB).to.have.length(1);
      expect(resultB[0].submission_feature_id).to.equal(featB);
    });

    it('should resolve filter-based features by re-running search query', async () => {
      // Filter-based downloads store filters JSONB on the download row and re-derive
      // the feature set at pipeline time by re-running the search CTE.
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Filter Test A' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Filter Test B' });
      // Create a non-matching feature to prove filter selectivity
      await createTestFeature(connection, submissionId, 'species_observation', { taxon_id: 1234, count: 1 });

      const filters = { feature_types: ['dataset'] };
      const { download_id } = await crudService.createDownload({ filters, format: 'csv' });

      const result = await crudService.getDownloadFeatures(download_id);

      // Should include both dataset features but not the species_observation
      const featureIds = result.map((f: { submission_feature_id: number }) => f.submission_feature_id);
      expect(featureIds).to.include(feat1);
      expect(featureIds).to.include(feat2);
      // All returned features should be datasets
      for (const f of result) {
        expect(f.feature_type_name).to.equal('dataset');
      }
    });

    it('should not leak features across cart-based and filter-based downloads', async () => {
      const submissionId = await createTestSubmission(connection);
      const cartFeat = await createTestFeature(connection, submissionId, 'species_observation', {
        taxon_id: 9999,
        count: 1
      });
      const filterFeat = await createTestFeature(connection, submissionId, 'dataset', { name: 'Filter Only' });

      // Cart download includes only the observation
      const cartDl = await createCartDownload([cartFeat]);
      // Filter download matches only datasets
      const filterDl = await crudService.createDownload({ filters: { feature_types: ['dataset'] }, format: 'csv' });

      const cartResult = await crudService.getDownloadFeatures(cartDl.download_id);
      expect(cartResult).to.have.length(1);
      expect(cartResult[0].submission_feature_id).to.equal(cartFeat);

      const filterResult = await crudService.getDownloadFeatures(filterDl.download_id);
      const filterIds = filterResult.map((f: { submission_feature_id: number }) => f.submission_feature_id);
      expect(filterIds).to.include(filterFeat);
      expect(filterIds).to.not.include(cartFeat);
    });
  });

  describe('estimateDownloadSize (filter-based)', () => {
    it('should return aggregate total for filter-based downloads via SQL SUM', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Size A' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Size B' });

      const filters = { feature_types: ['dataset'] };
      const { download_id } = await crudService.createDownload({ filters, format: 'csv' });

      const totalBytes = await service.estimateDownloadSize(download_id);

      // Should be > 0 (data_byte_size = octet_length(data::text) + 500 per feature)
      expect(totalBytes).to.be.greaterThan(0);

      // Cross-check: total should equal sum of individual features
      const features = await crudService.getDownloadFeatures(download_id);
      const expectedTotal = features
        .filter((f: { submission_feature_id: number }) => [feat1, feat2].includes(f.submission_feature_id))
        .reduce((sum: number, f: { estimated_byte_size: string }) => sum + Number(f.estimated_byte_size), 0);
      expect(totalBytes).to.be.greaterThanOrEqual(expectedTotal);
    });
  });

  describe('cursor streaming (streamDownloadFeatures)', () => {
    it('should stream cart-based features via DECLARE CURSOR / FETCH / CLOSE', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Stream A' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'Stream B' });
      const cartResponse = await cartService.createCart(connection.systemUserId(), [feat1, feat2]);

      const downloadRepo = new DownloadRepository(connection);

      // Cursor requires an open transaction — our test connection is already in one
      const batches: { submission_feature_id: number; feature_type_name: string }[][] = [];
      for await (const batch of downloadRepo.streamDownloadFeaturesByCartId(cartResponse.cart.cart_id, 1)) {
        batches.push(batch as any);
      }

      // With batchSize=1, should yield 2 batches of 1 row each
      expect(batches).to.have.length(2);
      const allIds = batches.flat().map((r) => r.submission_feature_id);
      expect(allIds).to.include(feat1);
      expect(allIds).to.include(feat2);
      for (const row of batches.flat()) {
        expect(row.feature_type_name).to.equal('dataset');
      }
    });

    it('should stream filter-based features via DECLARE CURSOR with embedded search CTE', async () => {
      const submissionId = await createTestSubmission(connection);
      const feat1 = await createTestFeature(connection, submissionId, 'dataset', { name: 'CursorFilter A' });
      const feat2 = await createTestFeature(connection, submissionId, 'dataset', { name: 'CursorFilter B' });

      const filters = { feature_types: ['dataset'] };
      const { download_id } = await crudService.createDownload({ filters, format: 'csv' });

      const downloadRepo = new DownloadRepository(connection);
      const searchService = new SearchFeatureService(connection);

      // Build the subquery the same way planFragments does
      const subquery = searchService.buildSearchFeatureIdsSubquery(filters, connection.systemUserId());
      const { sql, bindings } = subquery.toSQL().toNative();

      const batches: { submission_feature_id: number; feature_type_name: string }[][] = [];
      for await (const batch of downloadRepo.streamDownloadFeaturesBySearchQuery(
        download_id,
        sql,
        bindings as any[],
        1
      )) {
        batches.push(batch as any);
      }

      // With batchSize=1, at least 2 batches
      expect(batches.length).to.be.greaterThanOrEqual(2);
      const allIds = batches.flat().map((r) => r.submission_feature_id);
      expect(allIds).to.include(feat1);
      expect(allIds).to.include(feat2);
    });

    it('should yield empty for cart with no features', async () => {
      const systemUserId = connection.systemUserId();
      const cartResult = await connection.sql(SQL`
        INSERT INTO cart (system_user_id, cart_status, create_user)
        VALUES (${systemUserId}, 'active', ${systemUserId})
        RETURNING cart_id;
      `);

      const downloadRepo = new DownloadRepository(connection);
      const batches: unknown[][] = [];
      for await (const batch of downloadRepo.streamDownloadFeaturesByCartId(cartResult.rows[0].cart_id)) {
        batches.push(batch);
      }

      expect(batches).to.have.length(0);
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

      const { download_id } = await createCartDownload([childFeatureId]);
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

      const { download_id } = await createCartDownload([rootFeatureId]);
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
   * Helper: create an anonymous download (no team association).
   * The UUID is the only credential — anyone with the link can access it.
   */
  async function createAnonymousDownload(): Promise<string> {
    const submissionId = await createTestSubmission(connection);
    const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Anon' });
    const { download_id } = await createCartDownload([featureId]);
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
      const { download_id } = await createCartDownload([featureId]);

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
      const { download_id } = await createCartDownload([featureId]);

      const systemUserId = connection.systemUserId();
      await crudService.linkDownloadToNewTeam(download_id, systemUserId, 'Auth test team', 'Auth test team');

      const download = await crudService.getAuthorizedDownload(download_id, systemUserId);
      expect(download.download_id).to.equal(download_id);
    });

    it('should throw HTTP403 for non-team-member on team-linked download', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Locked' });
      const { download_id } = await createCartDownload([featureId]);

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
      const { download_id } = await createCartDownload([featureId]);

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
      const { download_id } = await createCartDownload([featureId]);

      await crudService.linkDownloadToNewTeam(download_id, apiUserId, 'Listing test team', 'Listing test team');

      const { downloads } = await crudService.getDownloadsByTeamMembership(apiUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.include(download_id);
    });

    it('should not return downloads the user has no team membership for', async () => {
      const submissionId = await createTestSubmission(connection);
      const featureId = await createTestFeature(connection, submissionId, 'dataset', { name: 'Private' });
      const { download_id } = await createCartDownload([featureId]);

      // Anonymous download (no team link) should not appear in team-based listing
      const otherUserId = await createOtherUser();
      const { downloads } = await crudService.getDownloadsByTeamMembership(otherUserId);
      const ids = downloads.map((d) => d.download_id);
      expect(ids).to.not.include(download_id);
    });
  });
});
