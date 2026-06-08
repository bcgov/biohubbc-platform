// Integration test for the request-time download VERSION EXPORT state machine —
// drives `DownloadExportService.createDownloadVersionExport` against a REAL
// database (transaction rollback isolation) to verify the resolve-or-create
// active-artifact-group contract:
//
//   - new shape          → materialize a group + enqueue one job
//   - ready / in-flight  → reuse the active group, no re-enqueue
//   - failed             → end the dead group (error_message preserved) + recreate
//   - exporter_version   → a stale-version `ready` group is ignored, fresh group built
//
// Each request still writes its own thin `download_version_export` row (per-user
// provenance), but lifecycle state lives on the shared GROUP. The export record
// omits the group id, so group-id assertions read the thin row directly.
//
// The pg-boss publish thunk (`DownloadExportService.dependencies.publish...`) is
// stubbed in every test — there is no real queue under make test-db — and we
// assert `calledOnce` / `notCalled` to pin the "genuinely new work" semantics.
//
// True cross-transaction concurrency (two connections racing the ON CONFLICT)
// and the one-job singleton collapse are proven in the companion system test;
// the race test here is a single-connection, deterministic collision that
// asserts the resolver's conflict/re-select contract.
//
// Uses a transaction that is ROLLED BACK after each test, so no data persists.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { EXPORTER_VERSION } from '../../constants/download';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadExportService } from '../../services/download/download-export-service';
import { DownloadService } from '../../services/download/download-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { ArtifactService } from '../../services/upload/artifact-service';

describe('Download version export state machine (integration)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let exportService: DownloadExportService;
  let exportRepo: DownloadVersionExportRepository;
  let versionRepo: DownloadVersionRepository;
  let downloadRepo: DownloadRepository;
  let downloadService: DownloadService;
  let artifactService: ArtifactService;

  const FORMAT = 'csv';
  const MODE = 'per_feature_type';
  const MAX_PART = '524288000';

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    exportService = new DownloadExportService(connection);
    exportRepo = new DownloadVersionExportRepository(connection);
    versionRepo = new DownloadVersionRepository(connection);
    downloadRepo = new DownloadRepository(connection);
    downloadService = new DownloadService(connection);
    artifactService = new ArtifactService(connection);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Stub the pg-boss publish thunk so `createDownloadVersionExport` never
   * touches a real queue from inside the rolled-back transaction. Returns the
   * stub so the test can assert `calledOnce` / `notCalled` and inspect the
   * `{ downloadVersionExportArtifactGroupId }` payload.
   */
  function stubPublish(): sinon.SinonStub {
    return sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob').resolves();
  }

  /**
   * Seed a READY download owned by the connection's system user, with a
   * materialized current version and one `download_version_artifact` link per
   * feature type.
   *
   * Models the download + team-auth seeding on `download-service.integration.ts`
   * so `DownloadService.getAuthorizedDownload(downloadId, systemUserId)` passes:
   * `createDownloadRequest` with `requestedBy = systemUserId` seeds a single-
   * member team from that identity, and the download is then forced to READY.
   *
   * Returns the download id, its current version id, and the artifact ids linked
   * to the version.
   */
  async function seedReadyDownloadWithVersionArtifact(
    featureTypeNames: string[] = ['dataset']
  ): Promise<{ downloadId: string; downloadVersionId: string; systemUserId: number; artifactIds: string[] }> {
    const systemUserId = connection.systemUserId();

    // createDownloadRequest publishes the parquet job — stub it so the create
    // path doesn't hit the real queue. (Distinct from the export publish thunk.)
    const downloadPublishStub = sinon
      .stub(DownloadService.dependencies, 'publishProcessDownloadJob')
      .resolves({ status: 'published', jobId: 'parquet-job' });

    const { download_id: downloadId } = await downloadService.createDownloadRequest({
      name: `export-test-${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: 'Version export integration test download',
      featureTypes: featureTypeNames,
      expression: null,
      requestedBy: systemUserId
    });

    // createDownloadRequest already materialized the current version — resolve it.
    const download = await downloadRepo.findDownloadById(downloadId);
    const downloadVersionId = download!.current_download_version_id as string;

    // The version is born `pending`; the export gate requires `ready`. Status lives
    // on the version and is sourced back onto the download.
    await versionRepo.updateDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.READY, {
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      materialized_at: new Date().toISOString()
    });

    // Link one parquet artifact per feature type to the version (the export
    // pipeline's discovery surface — `download_version_artifact`, NOT the
    // deleted `download_artifact`).
    const artifactIds: string[] = [];
    for (const featureTypeName of featureTypeNames) {
      const { artifact_id } = await artifactService.insertArtifact({
        bucket: 'test-bucket',
        object_key: `downloads/${downloadId}/${featureTypeName}/data.parquet`,
        byte_size: 1024,
        artifact_status: 'uploaded',
        checksum_sha256: 'a'.repeat(64),
        uploaded_at: new Date().toISOString(),
        format: 'parquet'
      });
      await versionRepo.createDownloadVersionArtifact(downloadVersionId, artifact_id, featureTypeName);
      artifactIds.push(artifact_id);
    }

    // The publish stub above is consumed; restore it so each test owns its own
    // export-publish stub without an extra count from create-time.
    downloadPublishStub.restore();

    return { downloadId, downloadVersionId, systemUserId, artifactIds };
  }

  /**
   * Read the group id off the thin `download_version_export` row directly — the
   * service's `DownloadVersionExportRecord` omits the group id, so this is the
   * only way to assert which group an export attached to.
   */
  async function readGroupIdForExport(exportId: string): Promise<string> {
    const result = await connection.sql(SQL`
      SELECT download_version_export_artifact_group_id
      FROM download_version_export
      WHERE download_version_export_id = ${exportId};
    `);
    expect(result.rowCount).to.equal(1);
    return result.rows[0].download_version_export_artifact_group_id;
  }

  /**
   * Count the active groups (record_end_date IS NULL) matching the full dedupe
   * key for a version — proves the active-uniqueness invariant from raw SQL,
   * independent of the resolver.
   */
  async function countActiveGroups(downloadVersionId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS n
      FROM download_version_export_artifact_group
      WHERE download_version_id = ${downloadVersionId}
        AND format = ${FORMAT}
        AND mode = ${MODE}
        AND max_part_size_bytes = ${MAX_PART}
        AND exporter_version = ${EXPORTER_VERSION}
        AND record_end_date IS NULL;
    `);
    return result.rows[0].n;
  }

  // ── New combination → one job ────────────────────────────────────────

  describe('new export shape', () => {
    it('materializes exactly one active group, one attached export, and enqueues one job', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();
      const publishStub = stubPublish();

      const record = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);

      // Exactly one active group exists for the shape.
      expect(await countActiveGroups(downloadVersionId)).to.equal(1);

      const groupId = await readGroupIdForExport(record.download_version_export_id);

      // Exactly one export row is attached to that group.
      const exportRows = await connection.sql(SQL`
        SELECT download_version_export_id
        FROM download_version_export
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(exportRows.rowCount).to.equal(1);

      // The freshly-materialized group starts `pending`.
      const group = await exportRepo.getExportArtifactGroupById(groupId);
      expect(group.status).to.equal(DownloadStatusEnum.PENDING);
      expect(record.status).to.equal(DownloadStatusEnum.PENDING);

      // One job published, carrying the group id.
      expect(publishStub.calledOnce).to.be.true;
      expect(publishStub.firstCall.args[1]).to.deep.equal({ downloadVersionExportArtifactGroupId: groupId });
    });
  });

  // ── Ready reuse → no job ─────────────────────────────────────────────

  describe('reuse of a ready group', () => {
    it('attaches a second export to the same ready group and does not re-enqueue', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // First request materializes the group.
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      expect(firstPublish.calledOnce).to.be.true;
      const groupId = await readGroupIdForExport(first.download_version_export_id);
      firstPublish.restore();

      // Drive the group to `ready` (pipeline finished).
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.READY, {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      // Second identical request reuses the ready group.
      const secondPublish = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);

      // Still exactly one active group.
      expect(await countActiveGroups(downloadVersionId)).to.equal(1);

      // The second export attached to the SAME group.
      expect(await readGroupIdForExport(second.download_version_export_id)).to.equal(groupId);

      // Two export rows now hang off the one group.
      const exportRows = await connection.sql(SQL`
        SELECT download_version_export_id
        FROM download_version_export
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(exportRows.rowCount).to.equal(2);

      // Reuse of a finished group never re-queues, and the new export inherits `ready`.
      expect(secondPublish.notCalled).to.be.true;
      expect(second.status).to.equal(DownloadStatusEnum.READY);
    });
  });

  // ── In-flight reuse → no job + empty parts ───────────────────────────

  describe('reuse of an in-flight group', () => {
    it('attaches to a pending group without re-enqueuing, and resolves no parts yet', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // First request leaves the group `pending` (a run is in flight).
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      const groupId = await readGroupIdForExport(first.download_version_export_id);
      firstPublish.restore();

      // Move it to `processing` — still an in-flight (non-failed, non-ready) state.
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.PROCESSING, {
        started_at: new Date().toISOString()
      });

      // Second request rides the in-flight group.
      const secondPublish = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);

      expect(await countActiveGroups(downloadVersionId)).to.equal(1);
      expect(await readGroupIdForExport(second.download_version_export_id)).to.equal(groupId);
      expect(secondPublish.notCalled).to.be.true;

      // The group has no part artifacts yet — part-URL resolution is empty.
      const parts = await exportService.listExportPartUrls(second.download_version_export_id, null);
      expect(parts).to.eql([]);
    });
  });

  // ── Concurrent race (single-connection deterministic collision) ──────

  describe('resolver conflict / re-select contract', () => {
    it('a duplicate createExportArtifactGroup is a silent no-op and both exports converge on the winner', async () => {
      // OPTION B: a single rollback-isolated connection cannot model true
      // cross-transaction concurrency (the ON CONFLICT serializes at the DB
      // across transactions). Instead we drive the deterministic collision the
      // resolver relies on: a second identical INSERT must NOT throw, and the
      // re-select must return the one winning row. True cross-transaction
      // concurrency + the one-job singleton collapse are proven in the system test.
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      const payload = {
        downloadVersionId,
        format: FORMAT,
        mode: MODE,
        maxPartSizeBytes: MAX_PART,
        exporterVersion: EXPORTER_VERSION
      };

      // No active group yet.
      expect(
        await exportRepo.findActiveExportArtifactGroup(downloadVersionId, FORMAT, MODE, MAX_PART, EXPORTER_VERSION)
      ).to.be.null;

      // First insert wins.
      await exportRepo.createExportArtifactGroup(payload);

      // Second identical insert collides on the partial-unique key → ON CONFLICT
      // DO NOTHING. rowCount 0 is valid; it must NOT throw.
      await exportRepo.createExportArtifactGroup(payload);

      // Re-select returns exactly the one winner.
      expect(await countActiveGroups(downloadVersionId)).to.equal(1);
      const winner = await exportRepo.findActiveExportArtifactGroup(
        downloadVersionId,
        FORMAT,
        MODE,
        MAX_PART,
        EXPORTER_VERSION
      );
      expect(winner).to.not.be.null;
      const winnerGroupId = winner!.download_version_export_artifact_group_id;

      // Two export requests through the service both converge on the winner group.
      const publishStub = stubPublish();
      const a = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      const b = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);

      expect(await readGroupIdForExport(a.download_version_export_id)).to.equal(winnerGroupId);
      expect(await readGroupIdForExport(b.download_version_export_id)).to.equal(winnerGroupId);

      // The group already existed (pending) before either service call, so neither
      // call materialized new work → no enqueue.
      expect(publishStub.notCalled).to.be.true;
    });
  });

  // ── Failed end-and-recreate ──────────────────────────────────────────

  describe('recovery from a failed group', () => {
    it('ends the failed group (preserving its error_message), creates a fresh group, and enqueues', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // First request materializes the group, then we drive it to `failed`.
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      const failedGroupId = await readGroupIdForExport(first.download_version_export_id);
      firstPublish.restore();

      await exportRepo.updateExportArtifactGroupStatus(failedGroupId, DownloadStatusEnum.FAILED, {
        completed_at: new Date().toISOString(),
        error_message: 'boom'
      });

      // Second request must end the dead group and build a fresh one.
      const publishStub = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      const freshGroupId = await readGroupIdForExport(second.download_version_export_id);

      // Fresh group is a different row.
      expect(freshGroupId).to.not.equal(failedGroupId);

      // Old group is ended but its error history is preserved.
      const oldGroup = await connection.sql(SQL`
        SELECT record_end_date, error_message
        FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${failedGroupId};
      `);
      expect(oldGroup.rows[0].record_end_date).to.not.be.null;
      expect(oldGroup.rows[0].error_message).to.equal('boom');

      // Fresh group is active with a clean slate.
      const freshGroup = await exportRepo.getExportArtifactGroupById(freshGroupId);
      expect(freshGroup.status).to.equal(DownloadStatusEnum.PENDING);
      expect(freshGroup.error_message).to.be.null;

      // Active-uniqueness never violated — exactly one active group for the key.
      expect(await countActiveGroups(downloadVersionId)).to.equal(1);

      // Genuinely new work → one job.
      expect(publishStub.calledOnce).to.be.true;
      expect(publishStub.firstCall.args[1]).to.deep.equal({ downloadVersionExportArtifactGroupId: freshGroupId });
    });
  });

  // ── exporter_version bump invalidates stale ready ────────────────────

  describe('exporter_version invalidation', () => {
    it('ignores a ready group at a stale exporter_version and builds a fresh group at the current version', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // Seed a `ready` group at exporter_version 0 (one less than the current
      // EXPORTER_VERSION=1). The repo helper always stamps EXPORTER_VERSION, so
      // the stale-version row must be inserted via raw SQL.
      const staleVersion = EXPORTER_VERSION - 1;
      const staleInsert = await connection.sql(SQL`
        INSERT INTO download_version_export_artifact_group
          (download_version_id, format, mode, max_part_size_bytes, exporter_version, status, started_at, completed_at)
        VALUES (
          ${downloadVersionId}, ${FORMAT}, ${MODE}, ${MAX_PART}, ${staleVersion}, ${DownloadStatusEnum.READY},
          now(), now()
        )
        RETURNING download_version_export_artifact_group_id;
      `);
      const staleGroupId = staleInsert.rows[0].download_version_export_artifact_group_id;

      // The service probes at EXPORTER_VERSION=1 → misses the v0 group.
      const publishStub = stubPublish();
      const record = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      const newGroupId = await readGroupIdForExport(record.download_version_export_id);

      // A fresh group was built at the current exporter_version — the stale one was NOT reused.
      expect(newGroupId).to.not.equal(staleGroupId);
      const newGroup = await exportRepo.getExportArtifactGroupById(newGroupId);
      expect(newGroup.exporter_version).to.equal(EXPORTER_VERSION);
      expect(newGroup.status).to.equal(DownloadStatusEnum.PENDING);

      // Building genuinely new work → one job.
      expect(publishStub.calledOnce).to.be.true;
    });
  });

  // ── Version creation + parquet link ──────────────────────────────────

  describe('version creation and parquet link', () => {
    it('createDownloadRequest materializes a version and points the download at it', async () => {
      const systemUserId = connection.systemUserId();
      const publishStub = sinon
        .stub(DownloadService.dependencies, 'publishProcessDownloadJob')
        .resolves({ status: 'published', jobId: 'parquet-job' });

      const { download_id: downloadId } = await downloadService.createDownloadRequest({
        name: `version-link-${Date.now()}-${randomUUID().slice(0, 8)}`,
        description: 'Version + parquet link test',
        featureTypes: ['dataset'],
        expression: null,
        requestedBy: systemUserId
      });
      expect(publishStub.calledOnce).to.be.true;

      // A download_version row exists for the download.
      const versionRows = await connection.sql(SQL`
        SELECT download_version_id
        FROM download_version
        WHERE download_id = ${downloadId};
      `);
      expect(versionRows.rowCount).to.equal(1);
      const downloadVersionId = versionRows.rows[0].download_version_id;

      // The download points at that version.
      const download = await downloadRepo.findDownloadById(downloadId);
      expect(download!.current_download_version_id).to.equal(downloadVersionId);

      // Parquet pipeline link path: createDownloadVersionArtifact writes a
      // download_version_artifact row keyed to the version.
      const { artifact_id } = await artifactService.insertArtifact({
        bucket: 'test-bucket',
        object_key: `downloads/${downloadId}/dataset/data.parquet`,
        byte_size: 2048,
        artifact_status: 'uploaded',
        checksum_sha256: 'b'.repeat(64),
        uploaded_at: new Date().toISOString(),
        format: 'parquet'
      });
      await versionRepo.createDownloadVersionArtifact(downloadVersionId, artifact_id, 'dataset');

      const linkRows = await connection.sql(SQL`
        SELECT download_version_id, artifact_id, feature_type_name
        FROM download_version_artifact
        WHERE download_version_id = ${downloadVersionId}
          AND artifact_id = ${artifact_id}
          AND record_end_date IS NULL;
      `);
      expect(linkRows.rowCount).to.equal(1);
      expect(linkRows.rows[0].feature_type_name).to.equal('dataset');
    });
  });

  // ── Part-URL resolution through the group ────────────────────────────

  describe('part-URL resolution', () => {
    it('orders parts by chunk_id, filters null byte_size, and signs the GROUP key while naming the file by download + version id', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // Materialize a group + export via the service.
      const publishStub = stubPublish();
      const record = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      publishStub.restore();
      const exportId = record.download_version_export_id;
      const groupId = await readGroupIdForExport(exportId);

      // Drive the group ready with a known started_at so the filename timestamp is deterministic.
      const startedAt = '2024-01-02T03:04:05.000Z';
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.READY, {
        started_at: startedAt,
        completed_at: new Date().toISOString()
      });

      // Insert two real part artifacts (with byte_size + object_key) and link
      // them to the group out of chunk order to prove ORDER BY chunk_id.
      const partKeys: Record<number, string> = {};
      for (const chunkId of [2, 1]) {
        const objectKey = `downloads/${downloadId}/versions/${downloadVersionId}/exports/${groupId}/biohub-${groupId}-part-${chunkId}.zip`;
        partKeys[chunkId] = objectKey;
        const { artifact_id } = await artifactService.insertArtifact({
          bucket: 'test-bucket',
          object_key: objectKey,
          byte_size: 100 + chunkId,
          artifact_status: 'uploaded',
          checksum_sha256: `${chunkId}`.repeat(64).slice(0, 64),
          uploaded_at: new Date().toISOString(),
          format: 'zip'
        });
        await exportRepo.createExportArtifactGroupArtifact(groupId, artifact_id, chunkId);
      }

      // A third artifact with NULL byte_size must be filtered out (pending part).
      const { artifact_id: pendingArtifactId } = await artifactService.insertArtifact({
        bucket: 'test-bucket',
        object_key: `downloads/${downloadId}/versions/${downloadVersionId}/exports/${groupId}/pending-part-3.zip`,
        byte_size: null,
        artifact_status: 'pending',
        checksum_sha256: null,
        uploaded_at: null,
        format: 'zip'
      });
      await exportRepo.createExportArtifactGroupArtifact(groupId, pendingArtifactId, 3);

      // Repo-level: artifacts come back ordered by chunk_id and the null-byte_size one is dropped.
      const artifacts = await exportRepo.listExportArtifactGroupArtifactsByExportId(exportId);
      expect(artifacts.map((a) => a.chunk_id)).to.eql([1, 2]);

      // Service-level: capture the signed-URL object-key argument.
      const signedUrlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .callsFake(async (_bucket, key) => `https://signed.example/${key}`);

      const parts = await exportService.listExportPartUrls(exportId, startedAt);

      expect(parts.map((p) => p.chunk_id)).to.eql([1, 2]);
      expect(parts[0].file_size_bytes).to.equal('101');
      expect(parts[1].file_size_bytes).to.equal('102');

      // The signed object key embeds the GROUP id (the shared physical part).
      const firstCall = signedUrlStub.getCall(0);
      expect(firstCall.args[0]).to.equal(BucketType.MAIN);
      expect(firstCall.args[1]).to.equal(partKeys[1]);
      expect(firstCall.args[1]).to.include(`/exports/${groupId}/`);

      // The Content-Disposition filename names the download + version, with the
      // started_at timestamp (2024-01-02 03:04:05 UTC) — not the export or group id.
      const contentDisposition = firstCall.args[3] as string;
      expect(contentDisposition).to.include(`${downloadId}_${downloadVersionId}_20240102-030405_part1.zip`);
      expect(contentDisposition).to.not.include(exportId);
      expect(contentDisposition).to.not.include(groupId);
    });
  });

  // ── List status derivation (reuse is write-free) ─────────────────────

  describe('list status derivation', () => {
    it('lists both exports of a ready group as ready with a JOINed part_count and no per-export status write', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // Two requests attach to one group.
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      firstPublish.restore();
      const groupId = await readGroupIdForExport(first.download_version_export_id);

      const secondPublish = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, {}, connection);
      secondPublish.restore();
      // Both attached to the same group (reuse, not a new group).
      expect(await readGroupIdForExport(second.download_version_export_id)).to.equal(groupId);

      // Drive the shared group to ready and give it two parts.
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.READY, {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });
      for (const chunkId of [1, 2]) {
        const { artifact_id } = await artifactService.insertArtifact({
          bucket: 'test-bucket',
          object_key: `downloads/${downloadId}/versions/${downloadVersionId}/exports/${groupId}/part-${chunkId}.zip`,
          byte_size: 100 + chunkId,
          artifact_status: 'uploaded',
          checksum_sha256: `${chunkId}`.repeat(64).slice(0, 64),
          uploaded_at: new Date().toISOString(),
          format: 'zip'
        });
        await exportRepo.createExportArtifactGroupArtifact(groupId, artifact_id, chunkId);
      }

      // The export table has no status column — status + part_count are JOINed
      // from the group, so both exports read `ready` with part_count 2 despite
      // no per-export status write ever happening.
      const list = await exportService.listDownloadVersionExportsByDownloadId(downloadId);
      expect(list).to.have.length(2);
      for (const row of list) {
        expect(row.status).to.equal(DownloadStatusEnum.READY);
        expect(row.part_count).to.equal(2);
      }

      // Independent proof there is no status column on the per-user export row.
      const columns = await connection.sql(SQL`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'download_version_export'
          AND column_name = 'status';
      `);
      expect(columns.rowCount).to.equal(0);
    });
  });
});
