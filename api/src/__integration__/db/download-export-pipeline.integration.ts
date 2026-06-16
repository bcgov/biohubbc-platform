// Integration test for the CSV download export pipeline — verifies the
// DownloadVersionExportRepository CRUD, the DownloadExportPipelineService state
// transitions, and the `writePartZip` contract (artifact + download_version_export_artifact
// rows, retry idempotency).
//
// Run: make test-db
// Requires: make web (database must be running with seed data)
//
// S3 is stubbed everywhere — `ObjectStorageService.uploadStream` resolves
// without consuming and `ParquetReader.openS3` returns an in-process cursor
// so the tests never touch MinIO. The real binary-streaming path lives in
// the companion system test under `__integration__/system/`.

import * as parquetjs from '@dsnp/parquetjs';
import archiver from 'archiver';
import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { EXPORTER_VERSION } from '../../constants/download';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { ArtifactService } from '../../services/upload/artifact-service';
import { createHashCountStream } from '../../utils/hash-stream';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * Stub `ParquetReader.openS3` with an in-process reader whose cursor yields
 * the given rows then null. `close()` resolves. The pipeline re-opens the
 * reader once per feature type, so every call returns the same cursor shape.
 */
function stubParquetReaderWithRows(rows: Record<string, unknown>[]): sinon.SinonStub {
  return sinon.stub(parquetjs.ParquetReader, 'openS3').callsFake(async () => {
    let index = 0;
    const cursor = {
      next: async () => {
        if (index >= rows.length) {
          return null;
        }
        return rows[index++];
      }
    };
    return {
      getCursor: () => cursor,
      close: async () => undefined
    } as unknown as parquetjs.ParquetReader;
  });
}

/**
 * Stand up a fresh archiver bundle that mirrors `createPartArchiverBundle` —
 * archiver → passthrough → hashCount. Callers stub
 * `ObjectStorageService.uploadStream` at the test level so the bytes drain
 * into a no-op S3 sink.
 */
function buildArchiverBundle(): {
  archive: archiver.Archiver;
  uploadPromise: Promise<void>;
  hashCount: ReturnType<typeof createHashCountStream>;
} {
  const archive = archiver('zip', { zlib: { level: 5 } });
  const passThrough = new PassThrough();
  const hashCount = createHashCountStream();

  archive.on('error', (err) => passThrough.destroy(err));
  archive.pipe(passThrough);
  passThrough.pipe(hashCount.transform);

  // Drain hashCount to /dev/null so backpressure never stalls the pipe.
  const uploadPromise: Promise<void> = new Promise((resolve, reject) => {
    hashCount.transform.on('end', () => resolve());
    hashCount.transform.on('error', (err) => reject(err));
    hashCount.transform.resume();
  });

  return { archive, uploadPromise, hashCount };
}

describe('Download Export pipeline (integration)', function () {
  // OOM skeleton + multi-part runs need headroom; happy-path tests complete well under this.
  this.timeout(60000);

  let connection: IDBConnection;
  let exportRepo: DownloadVersionExportRepository;
  let versionRepo: DownloadVersionRepository;
  let pipelineService: DownloadExportPipelineService;
  let downloadService: DownloadService;
  let policyService: DownloadPolicyService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    exportRepo = new DownloadVersionExportRepository(connection);
    versionRepo = new DownloadVersionRepository(connection);
    pipelineService = new DownloadExportPipelineService(connection);
    downloadService = new DownloadService(connection);
    policyService = new DownloadPolicyService(connection);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Seed a READY download with one `download_version_artifact` row per feature type.
   *
   * Inserts the per-feature-type Parquet artifacts the export pipeline
   * discovers via `listExportFeatureTypes` — the bytes aren't real (we stub
   * `ParquetReader.openS3`), but the key shape has to match
   * `downloads/{downloadId}/versions/{downloadVersionId}/{featureType}/data.parquet`
   * or `parseFeatureTypeFromParquetKey` drops them.
   */
  async function seedReadyDownloadWithParquetArtifact(
    featureTypeNames: string[]
  ): Promise<{ downloadId: string; downloadVersionId: string; artifactIds: string[] }> {
    const submissionId = await createTestSubmission(connection);
    // One feature per type so the policy has matching data; content isn't read by the export pipeline
    // (rows come from the stubbed ParquetReader, not the submission_feature table).
    for (const featureTypeName of featureTypeNames) {
      await createTestFeature(connection, submissionId, featureTypeName, {
        name: `${featureTypeName}-seed`
      });
    }

    const { policy_id } = await policyService.createDownloadPolicy({
      name: `export-pipeline-test-${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      featureTypes: featureTypeNames,
      expressionId: null
    });
    const { download_id: downloadId } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });

    // Materialize a download version. The export pipeline discovers feature types
    // from the version's artifact links; reads resolve the most-recent version.
    const version = await versionRepo.createDownloadVersion(downloadId);
    const downloadVersionId = version.download_version_id;

    // Transition the version pending → ready directly via the repo (no pipeline work
    // to do here). The download's status is sourced from its most-recent version.
    await versionRepo.updateDownloadVersionStatus(downloadVersionId, DownloadStatusEnum.READY, {
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      materialized_at: new Date().toISOString()
    });

    const artifactService = new ArtifactService(connection);
    const artifactIds: string[] = [];
    for (const featureTypeName of featureTypeNames) {
      const objectKey = `downloads/${downloadId}/versions/${downloadVersionId}/${featureTypeName}/data.parquet`;
      const { artifact_id } = await artifactService.insertArtifact({
        bucket: 'test-bucket',
        object_key: objectKey,
        byte_size: 1024,
        artifact_status: 'uploaded',
        checksum_sha256: 'a'.repeat(64),
        uploaded_at: new Date().toISOString(),
        format: 'parquet'
      });
      // The export pipeline discovers feature types from the version's artifact links.
      await versionRepo.createDownloadVersionArtifact(downloadVersionId, artifact_id, featureTypeName);
      artifactIds.push(artifact_id);
    }

    return { downloadId, downloadVersionId, artifactIds };
  }

  /**
   * Materialize an export-artifact group for the version + create a pending
   * download_version_export attached to it.
   *
   * Returns both the export id and the group id: lifecycle state (status/timing)
   * now lives on the GROUP, so status assertions and the pipeline entrypoint key
   * off `groupId`, while artifact-link reads key off `exportId`.
   */
  async function seedPendingExport(
    downloadVersionId: string,
    maxPartSizeBytes = '524288000'
  ): Promise<{ exportId: string; groupId: string }> {
    const format = 'csv' as const;
    const mode = 'per_feature_type' as const;

    await exportRepo.createExportArtifactGroup({
      downloadVersionId,
      format,
      mode,
      maxPartSizeBytes,
      exporterVersion: EXPORTER_VERSION
    });
    const group = await exportRepo.findActiveExportArtifactGroup(
      downloadVersionId,
      format,
      mode,
      maxPartSizeBytes,
      EXPORTER_VERSION
    );
    // The group was just created (or already active) — non-null by construction.
    const groupId = group!.download_version_export_artifact_group_id;

    const record = await exportRepo.createDownloadVersionExport({
      download_version_id: downloadVersionId,
      format,
      mode,
      max_part_size_bytes: maxPartSizeBytes,
      download_version_export_artifact_group_id: groupId
    });
    return { exportId: record.download_version_export_id, groupId };
  }

  // ── Tests ────────────────────────────────────────────────────────────

  describe('DownloadVersionExportRepository.createDownloadVersionExport', () => {
    it('persists the expected row and returns the full record', async () => {
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['dataset']);

      const { groupId } = await seedPendingExport(downloadVersionId);

      const record = await exportRepo.createDownloadVersionExport({
        download_version_id: downloadVersionId,
        format: 'csv',
        mode: 'per_feature_type',
        max_part_size_bytes: '524288000',
        download_version_export_artifact_group_id: groupId
      });

      // The thin export row carries no lifecycle state — status/timing live on the group.
      expect(record.format).to.equal('csv');
      expect(record.mode).to.equal('per_feature_type');
      expect(record.max_part_size_bytes).to.equal('524288000');
      expect(record.download_version_export_artifact_group_id).to.equal(groupId);
      const group = await exportRepo.getExportArtifactGroupById(groupId);
      expect(group.status).to.equal(DownloadStatusEnum.PENDING);
      expect(group.started_at).to.be.null;
      expect(group.completed_at).to.be.null;

      // Verify the row landed with those same fields.
      const persisted = await connection.sql(SQL`
        SELECT
          download_version_export_id,
          download_version_id,
          download_version_export_artifact_group_id,
          format,
          mode,
          max_part_size_bytes
        FROM download_version_export
        WHERE download_version_export_id = ${record.download_version_export_id};
      `);
      expect(persisted.rowCount).to.equal(1);
      expect(persisted.rows[0].download_version_id).to.equal(downloadVersionId);
      expect(persisted.rows[0].format).to.equal('csv');
      expect(persisted.rows[0].mode).to.equal('per_feature_type');
      expect(String(persisted.rows[0].max_part_size_bytes)).to.equal('524288000');
    });
  });

  describe('runExportGroup status transitions', () => {
    it('pending → processing → ready persists the expected timestamps', async () => {
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['dataset']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      // Stub the write-sink so the real archiver bytes drain into a no-op S3 upload.
      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      // At least one row is required — the empty-zip guard in `runExportGroup` refuses
      // to finalize an export where every feature type resolves to zero rows.
      stubParquetReaderWithRows([
        {
          uuid: '00000000-0000-0000-0000-000000000001',
          parent_uuid: null,
          submission_feature_id: 1
        }
      ]);

      await pipelineService.runExportGroup(groupId);
      const row = await connection.sql(SQL`
        SELECT status, started_at, completed_at
        FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(row.rowCount).to.equal(1);
      expect(row.rows[0].status).to.equal(DownloadStatusEnum.READY);
      expect(row.rows[0].started_at).to.not.be.null;
      expect(row.rows[0].completed_at).to.not.be.null;
      // started_at <= completed_at
      expect(new Date(row.rows[0].completed_at).getTime()).to.be.at.least(new Date(row.rows[0].started_at).getTime());
    });

    it('illegal transition (ready → ready from [processing]) throws ApiConflictError', async () => {
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['dataset']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      // Force the group to READY so a PROCESSING-only transition is illegal.
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.READY, {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      try {
        await pipelineService.transitionGroupStatus(groupId, DownloadStatusEnum.READY, [DownloadStatusEnum.PROCESSING]);
        expect.fail('Expected ApiConflictError for illegal transition from READY');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });
  });

  describe('writePartZip', () => {
    it('inserts one artifact + one download_version_export_artifact row with chunk_id = partIndex', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['dataset']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      const { archive, uploadPromise, hashCount } = buildArchiverBundle();
      // Append one tiny entry so the finalized zip has bytes.
      archive.append('header\n', { name: 'dataset/chunk1.csv' });

      const result = await pipelineService.writePartZip({
        groupId,
        downloadId,
        downloadVersionId,
        partIndex: 1,
        archive,
        uploadPromise,
        hashCount
      });

      expect(result.artifactId).to.be.a('string').with.length.greaterThan(0);
      expect(result.byteCount).to.be.greaterThan(0);

      const expectedKey = `downloads/${downloadId}/versions/${downloadVersionId}/exports/${groupId}/biohub-${groupId}-part-1.zip`;

      const artifactRows = await connection.sql(SQL`
        SELECT artifact_id, bucket, object_key, byte_size, checksum_sha256, artifact_status, format
        FROM artifact
        WHERE object_key = ${expectedKey};
      `);
      expect(artifactRows.rowCount).to.equal(1);
      expect(artifactRows.rows[0].artifact_id).to.equal(result.artifactId);
      expect(artifactRows.rows[0].format).to.equal('zip');
      expect(artifactRows.rows[0].artifact_status).to.equal('uploaded');
      expect(artifactRows.rows[0].checksum_sha256).to.match(/^[0-9a-f]{64}$/);
      expect(Number(artifactRows.rows[0].byte_size)).to.be.greaterThan(0);
      const joinRows = await connection.sql(SQL`
        SELECT download_version_export_artifact_id, download_version_export_artifact_group_id, artifact_id, chunk_id
        FROM download_version_export_artifact
        WHERE download_version_export_artifact_group_id = ${groupId}
          AND record_end_date IS NULL;
      `);
      expect(joinRows.rowCount).to.equal(1);
      expect(joinRows.rows[0].artifact_id).to.equal(result.artifactId);
      expect(joinRows.rows[0].chunk_id).to.equal(1);
    });

    it('is idempotent on retry — two calls leave one artifact and one join row', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['dataset']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      const first = buildArchiverBundle();
      first.archive.append('header\n', { name: 'dataset/chunk1.csv' });
      const firstResult = await pipelineService.writePartZip({
        groupId,
        downloadId,
        downloadVersionId,
        partIndex: 1,
        archive: first.archive,
        uploadPromise: first.uploadPromise,
        hashCount: first.hashCount
      });

      // Second call uses a brand-new archiver — archiver can't be finalized twice.
      const second = buildArchiverBundle();
      second.archive.append('header\n', { name: 'dataset/chunk1.csv' });
      const secondResult = await pipelineService.writePartZip({
        groupId,
        downloadId,
        downloadVersionId,
        partIndex: 1,
        archive: second.archive,
        uploadPromise: second.uploadPromise,
        hashCount: second.hashCount
      });

      expect(secondResult.artifactId).to.equal(firstResult.artifactId);

      const expectedKey = `downloads/${downloadId}/versions/${downloadVersionId}/exports/${groupId}/biohub-${groupId}-part-1.zip`;

      const artifactRows = await connection.sql(SQL`
        SELECT artifact_id
        FROM artifact
        WHERE object_key = ${expectedKey};
      `);
      expect(artifactRows.rowCount).to.equal(1);
      const joinRows = await connection.sql(SQL`
        SELECT download_version_export_artifact_id
        FROM download_version_export_artifact
        WHERE download_version_export_artifact_group_id = ${groupId}
          AND record_end_date IS NULL;
      `);
      expect(joinRows.rowCount).to.equal(1);
    });
  });

  describe('runExportGroup zero-row feature type', () => {
    it('throws rather than writing an empty zip; leaves no part-zip artifact and status non-READY', async () => {
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['dataset']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      sinon.stub(ObjectStorageService.prototype, 'uploadStream').resolves();
      stubParquetReaderWithRows([]);

      let caught: Error | undefined;
      try {
        await pipelineService.runExportGroup(groupId);
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(caught?.message).to.include('zero rows');
      // Pipeline threw before finalizing any part — no download_version_export_artifact rows landed.
      const joinRows = await connection.sql(SQL`
        SELECT dvea.download_version_export_artifact_id
        FROM download_version_export_artifact dvea
        WHERE dvea.download_version_export_artifact_group_id = ${groupId}
          AND dvea.record_end_date IS NULL;
      `);
      expect(joinRows.rowCount).to.equal(0);

      // The PROCESSING transition landed but READY never fired — terminal FAILED
      // is owned by the pg-boss DLQ handler (retry-as-lifecycle), not runExportGroup.
      const groupRow = await connection.sql(SQL`
        SELECT status FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(groupRow.rows[0].status).to.equal(DownloadStatusEnum.PROCESSING);
    });
  });
});
