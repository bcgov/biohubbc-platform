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
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS, EXPORTER_VERSION } from '../../constants/download';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
import { ExportConfig } from '../../models/download-export-config';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { ArtifactService } from '../../services/upload/artifact-service';
import { canonicalizeExportConfig, computeConfigHash } from '../../utils/export-config-utils';
import { buildPartZipKey } from '../../utils/export-utils';
import { createHashCountStream } from '../../utils/hash-stream';
import { createTestFeature, createTestSubmission } from '../helpers/test-submission-helpers';

/**
 * Build an in-process `ParquetReader` over a fixed row set: a cursor that yields
 * each row then null, plus `getRowCount()` (the denormalized build-side preflight
 * reads the footer row count before buffering) and a no-op `close()`.
 *
 * `declaredRowCount` overrides what `getRowCount()` reports, decoupling the footer
 * count from the cursor's actual rows. Real Parquet carries the count in its footer
 * (no scan), so a reader can legitimately declare N rows while a test serves a
 * shorter cursor — the lever the over-budget preflight test pulls to prove the
 * guard reads the footer, not the rows. Defaults to the row set's own length.
 */
function fakeParquetReader(rows: Record<string, unknown>[], declaredRowCount?: number): parquetjs.ParquetReader {
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
    getRowCount: async () => BigInt(declaredRowCount ?? rows.length),
    close: async () => undefined
  } as unknown as parquetjs.ParquetReader;
}

/**
 * Stub `ParquetReader.openS3` with an in-process reader whose cursor yields
 * the given rows then null. `close()` resolves and `getRowCount()` reports the
 * row count. The pipeline re-opens the reader once per feature type, so every
 * call returns the same cursor shape — fine for the single-type per-feature-type
 * paths that use this helper.
 */
function stubParquetReaderWithRows(rows: Record<string, unknown>[]): sinon.SinonStub {
  return sinon.stub(parquetjs.ParquetReader, 'openS3').callsFake(async () => fakeParquetReader(rows));
}

/**
 * Stub `ParquetReader.openS3` so each feature type serves its OWN rows.
 *
 * A denormalized two-type join opens the root type's Parquet and each dimension
 * type's Parquet from the SAME `openS3` seam — so a blanket stub would feed the
 * dimension the root's rows. The real `openParquetReader` builds the version-scoped
 * S3 key as `downloads/{downloadId}/versions/{downloadVersionId}/{featureType}/data.parquet`,
 * so the feature type is the FIFTH path segment (index 4) of `params.Key`; dispatch
 * on it to return the right rows.
 *
 * An unknown feature type returns an empty reader (zero rows) rather than
 * throwing, so a config that references a materialized-but-unseeded type simply
 * contributes nothing — closer to real Parquet (empty file) than a hard error.
 *
 * `declaredRowCountsByType` overrides the footer row count a given type reports
 * independently of the rows it serves — used by the over-budget preflight test to
 * declare a huge dimension while serving an empty cursor.
 */
function stubParquetReadersByType(
  rowsByType: Record<string, Record<string, unknown>[]>,
  declaredRowCountsByType: Record<string, number> = {}
): sinon.SinonStub {
  return sinon.stub(parquetjs.ParquetReader, 'openS3').callsFake(async (_client: unknown, params: { Key: string }) => {
    const featureType = params.Key.split('/')[4];
    return fakeParquetReader(rowsByType[featureType] ?? [], declaredRowCountsByType[featureType]);
  });
}

/**
 * Tee `ObjectStorageService.uploadStream` to an in-memory buffer instead of S3.
 *
 * The real stub drains to nothing; this one consumes the streamed bytes (so
 * backpressure never stalls the archiver pipe) and keeps them keyed by the part
 * object key. Tests then unzip the captured part to assert on the real CSV bytes.
 *
 * Returns the capture map plus a helper to extract a single part's CSV text — the
 * part-zip packages each chunk under `biohub-export-{groupId}/{featureType}/chunkN.csv`
 * (see `runDenormalizedExport` / `writeFeatureTypeExport`), so the helper returns
 * the concatenated text of every `.csv` entry in the captured zip, newest part
 * first is irrelevant — we assert per part key.
 */
function stubUploadCapture(): {
  stub: sinon.SinonStub;
  captured: Map<string, Buffer>;
  csvEntries: (objectKey: string) => { name: string; text: string }[];
} {
  const captured = new Map<string, Buffer>();

  const stub = sinon
    .stub(ObjectStorageService.prototype, 'uploadStream')
    .callsFake(async (_bucket: unknown, stream: Readable, _mimetype: unknown, key: string) => {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => resolve());
        stream.on('error', (err: Error) => reject(err));
      });
      captured.set(key, Buffer.concat(chunks));
    });

  const csvEntries = (objectKey: string): { name: string; text: string }[] => {
    const buffer = captured.get(objectKey);
    if (!buffer) {
      throw new Error(`stubUploadCapture: no captured upload for key ${objectKey}`);
    }
    return new AdmZip(buffer)
      .getEntries()
      .filter((entry) => entry.entryName.endsWith('.csv'))
      .map((entry) => ({ name: entry.entryName, text: entry.getData().toString('utf8') }));
  };

  return { stub, captured, csvEntries };
}

/**
 * Split a captured CSV into its header columns and non-empty data rows. The
 * writer terminates every line with `\n`, so a trailing empty token is trimmed.
 */
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((line) => line.length > 0);
  const header = (lines[0] ?? '').split(',');
  const rows = lines.slice(1).map((line) => line.split(','));
  return { header, rows };
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

/**
 * A minimal valid `per_feature_type` recipe over one feature type, referencing
 * only the always-present `uuid` structural column. Used as the default config
 * for `seedPendingExport` when a test doesn't supply its own recipe.
 */
function defaultPerTypeConfig(featureType = 'survey'): ExportConfig {
  return ExportConfig.parse({
    version: 1,
    export_type: 'csv',
    mode: 'per_feature_type',
    feature_types: [featureType],
    merge_steps: [],
    output_columns: [{ feature_type: featureType, column: 'uuid' }]
  });
}

// Root `survey` joined to dimension `animal` on survey.uuid = animal.parent_uuid
// (a real star-schema link — an animal's parent_uuid points at its survey's
// uuid). Output selects the root's `name` and the dimension's `animal_identifier`;
// the dimension column is prefixed `animal_animal_identifier` for header uniqueness.
function surveyAnimalConfig(): ExportConfig {
  return ExportConfig.parse({
    version: 1,
    export_type: 'csv',
    mode: 'denormalized',
    root_feature_type: 'survey',
    feature_types: ['survey', 'animal'],
    merge_steps: [
      {
        left_feature_type: 'survey',
        left_column: 'uuid',
        right_feature_type: 'animal',
        right_column: 'parent_uuid',
        merge_type: 'left'
      }
    ],
    output_columns: [
      { feature_type: 'survey', column: 'uuid' },
      { feature_type: 'survey', column: 'name' },
      { feature_type: 'animal', column: 'animal_identifier' }
    ]
  });
}

/** The single part-zip key the denormalized pipeline writes for one small export. */
function part1Key(downloadId: string, downloadVersionId: string, groupId: string): string {
  return buildPartZipKey(downloadId, downloadVersionId, groupId, 1);
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
   * The group row is written DIRECTLY (bypassing service validation), so the test
   * has full control of the `config` — denormalized tests pass their own recipe.
   * The recipe is canonicalized + hashed via the production helpers and stored
   * alongside its `config_hash` (the new dedupe key); `format`/`mode` are
   * denormalized from the config.
   *
   * Returns both the export id and the group id: lifecycle state (status/timing)
   * now lives on the GROUP, so status assertions and the pipeline entrypoint key
   * off `groupId`, while artifact-link reads key off `exportId`.
   */
  async function seedPendingExport(
    downloadVersionId: string,
    config: ExportConfig = defaultPerTypeConfig(),
    maxPartSizeBytes = '524288000'
  ): Promise<{ exportId: string; groupId: string }> {
    const normalized = canonicalizeExportConfig(config);
    const configHash = computeConfigHash(normalized);

    await exportRepo.createExportArtifactGroup({
      downloadVersionId,
      config: normalized,
      configHash,
      format: normalized.export_type,
      mode: normalized.mode,
      maxPartSizeBytes,
      exporterVersion: EXPORTER_VERSION
    });
    const group = await exportRepo.findActiveExportArtifactGroup(
      downloadVersionId,
      configHash,
      maxPartSizeBytes,
      EXPORTER_VERSION
    );
    // The group was just created (or already active) — non-null by construction.
    const groupId = group!.download_version_export_artifact_group_id;

    const record = await exportRepo.createDownloadVersionExport({
      download_version_id: downloadVersionId,
      format: normalized.export_type,
      mode: normalized.mode,
      max_part_size_bytes: maxPartSizeBytes,
      download_version_export_artifact_group_id: groupId
    });
    return { exportId: record.download_version_export_id, groupId };
  }

  // ── Tests ────────────────────────────────────────────────────────────

  describe('DownloadVersionExportRepository.createDownloadVersionExport', () => {
    it('persists the expected row and returns the full record', async () => {
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);

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
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);
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
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);
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
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      const { archive, uploadPromise, hashCount } = buildArchiverBundle();
      // Append one tiny entry so the finalized zip has bytes.
      archive.append('header\n', { name: 'survey/chunk1.csv' });

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
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);
      const { groupId } = await seedPendingExport(downloadVersionId);

      const first = buildArchiverBundle();
      first.archive.append('header\n', { name: 'survey/chunk1.csv' });
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
      second.archive.append('header\n', { name: 'survey/chunk1.csv' });
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
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);
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

  // ── Denormalized join correctness (full pipeline + real CSV output) ──
  //
  // These run the WHOLE denormalized pipeline (build dimension maps → stream the
  // root → broadcast left-join → write part-zips) and validate the ACTUAL CSV
  // bytes by teeing `uploadStream` into memory and unzipping the captured part.
  // Rows come from the stubbed `ParquetReader.openS3` dispatched per feature type,
  // so the join inputs are fully controlled; the group row is written directly,
  // so no `validateExportConfig` pass is needed here.
  describe('runExportGroup denormalized join', () => {
    it('single match: one CSV, prefixed dimension column in the header, one joined row per matched root row', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey', 'animal']);
      const { groupId } = await seedPendingExport(downloadVersionId, surveyAnimalConfig());

      const upload = stubUploadCapture();
      stubParquetReadersByType({
        survey: [{ submission_feature_id: 1, uuid: 'ds-uuid-1', parent_uuid: null, name: 'Survey One' }],
        animal: [
          {
            submission_feature_id: 10,
            uuid: 'an-uuid-1',
            parent_uuid: 'ds-uuid-1',
            animal_identifier: 'ANIMAL-1'
          }
        ]
      });

      await pipelineService.runExportGroup(groupId);

      // Group reached READY.
      const groupRow = await connection.sql(SQL`
        SELECT status FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(groupRow.rows[0].status).to.equal(DownloadStatusEnum.READY);

      // Exactly ONE part-zip artifact was written.
      const partKey = part1Key(downloadId, downloadVersionId, groupId);
      expect([...upload.captured.keys()], 'exactly one part-zip uploaded').to.eql([partKey]);

      // The captured part contains exactly one CSV with the joined output.
      const csvs = upload.csvEntries(partKey);
      expect(csvs.length, 'one CSV entry in the part-zip').to.equal(1);
      const { header, rows } = parseCsv(csvs[0].text);

      // Header carries the root columns raw and the dimension column prefixed.
      expect(header).to.eql(['survey_uuid', 'survey_name', 'animal_animal_identifier']);

      // Exactly one output row for the single matched root row, with the dimension populated.
      expect(rows.length).to.equal(1);
      expect(rows[0]).to.eql(['ds-uuid-1', 'Survey One', 'ANIMAL-1']);
    });

    it('left join keeps an unmatched root row (non-null key with no match) with empty right cells', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey', 'animal']);
      const { groupId } = await seedPendingExport(downloadVersionId, surveyAnimalConfig());

      const upload = stubUploadCapture();
      stubParquetReadersByType({
        // Root row's uuid 'ds-uuid-orphan' has a non-null key but no animal points at it.
        survey: [{ submission_feature_id: 1, uuid: 'ds-uuid-orphan', parent_uuid: null, name: 'Lonely Survey' }],
        // The animal's parent_uuid points elsewhere, so it never matches the root.
        animal: [
          {
            submission_feature_id: 10,
            uuid: 'an-uuid-1',
            parent_uuid: 'ds-uuid-other',
            animal_identifier: 'ANIMAL-1'
          }
        ]
      });

      await pipelineService.runExportGroup(groupId);

      const partKey = part1Key(downloadId, downloadVersionId, groupId);
      const { header, rows } = parseCsv(upload.csvEntries(partKey)[0].text);
      expect(header).to.eql(['survey_uuid', 'survey_name', 'animal_animal_identifier']);

      // The unmatched root row is KEPT (left join) with an empty dimension cell.
      expect(rows.length).to.equal(1);
      expect(rows[0]).to.eql(['ds-uuid-orphan', 'Lonely Survey', '']);
    });

    it('null root join key never spuriously matches a null-keyed dimension row (NULL ≠ NULL)', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey', 'animal']);
      // Join the root ON `parent_uuid` (which is null on a root survey row) so the
      // probe key is null. A null-keyed dimension row must NOT match it.
      const config = ExportConfig.parse({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'survey',
        feature_types: ['survey', 'animal'],
        merge_steps: [
          {
            left_feature_type: 'survey',
            left_column: 'parent_uuid',
            right_feature_type: 'animal',
            right_column: 'parent_uuid',
            merge_type: 'left'
          }
        ],
        output_columns: [
          { feature_type: 'survey', column: 'uuid' },
          { feature_type: 'animal', column: 'animal_identifier' }
        ]
      });
      const { groupId } = await seedPendingExport(downloadVersionId, config);

      const upload = stubUploadCapture();
      stubParquetReadersByType({
        // Root survey row with a NULL parent_uuid → null probe key.
        survey: [{ submission_feature_id: 1, uuid: 'ds-uuid-1', parent_uuid: null, name: 'Root Survey' }],
        // A dimension row whose join key (parent_uuid) is ALSO null — it must be
        // skipped at build time (null keys never indexed), so the null root key
        // finds no match rather than spuriously joining null-to-null.
        animal: [
          {
            submission_feature_id: 10,
            uuid: 'an-uuid-1',
            parent_uuid: null,
            animal_identifier: 'ANIMAL-NULL'
          }
        ]
      });

      await pipelineService.runExportGroup(groupId);

      const partKey = part1Key(downloadId, downloadVersionId, groupId);
      const { header, rows } = parseCsv(upload.csvEntries(partKey)[0].text);
      expect(header).to.eql(['survey_uuid', 'animal_animal_identifier']);

      // The root row is kept, but the null-keyed dimension did NOT match → empty cell.
      expect(rows.length).to.equal(1);
      expect(rows[0]).to.eql(['ds-uuid-1', '']);
    });

    it('fan-out: a root row matching two dimension rows produces two output rows', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey', 'animal']);
      const { groupId } = await seedPendingExport(downloadVersionId, surveyAnimalConfig());

      const upload = stubUploadCapture();
      stubParquetReadersByType({
        survey: [{ submission_feature_id: 1, uuid: 'ds-uuid-1', parent_uuid: null, name: 'Survey One' }],
        // Two animals both point at the one survey → fan-out to two output rows.
        animal: [
          { submission_feature_id: 10, uuid: 'an-uuid-1', parent_uuid: 'ds-uuid-1', animal_identifier: 'ANIMAL-1' },
          { submission_feature_id: 11, uuid: 'an-uuid-2', parent_uuid: 'ds-uuid-1', animal_identifier: 'ANIMAL-2' }
        ]
      });

      await pipelineService.runExportGroup(groupId);

      const partKey = part1Key(downloadId, downloadVersionId, groupId);
      const { header, rows } = parseCsv(upload.csvEntries(partKey)[0].text);
      expect(header).to.eql(['survey_uuid', 'survey_name', 'animal_animal_identifier']);

      // One root row fanned out to exactly two output rows — one per matched animal.
      expect(rows.length).to.equal(2);
      expect(rows.map((row) => row[2]).sort((a, b) => a.localeCompare(b))).to.eql(['ANIMAL-1', 'ANIMAL-2']);
      // Both rows carry the SAME root columns (the root row broadcast across matches).
      for (const row of rows) {
        expect([row[0], row[1]]).to.eql(['ds-uuid-1', 'Survey One']);
      }
    });

    it('degenerate single-type passthrough (merge_steps: []) emits one CSV of that type rows (Edge 6)', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey']);
      // Denormalized, one type, no merges, no output_columns → all columns of that
      // type, passed through (the "omitted output_columns ⇒ all columns" default).
      const config = ExportConfig.parse({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'survey',
        feature_types: ['survey'],
        merge_steps: []
      });
      const { groupId } = await seedPendingExport(downloadVersionId, config);

      const upload = stubUploadCapture();
      stubParquetReadersByType({
        survey: [
          { submission_feature_id: 1, uuid: 'ds-uuid-1', parent_uuid: null, name: 'Survey One' },
          { submission_feature_id: 2, uuid: 'ds-uuid-2', parent_uuid: null, name: 'Survey Two' }
        ]
      });

      await pipelineService.runExportGroup(groupId);

      const groupRow = await connection.sql(SQL`
        SELECT status FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(groupRow.rows[0].status).to.equal(DownloadStatusEnum.READY);

      const partKey = part1Key(downloadId, downloadVersionId, groupId);
      const csvs = upload.csvEntries(partKey);
      expect(csvs.length, 'one CSV entry').to.equal(1);
      const { header, rows } = parseCsv(csvs[0].text);

      // All of survey's materialized columns are present (structural first), and the
      // selected schema columns carry their raw root names (root columns unprefixed).
      expect(header).to.include.members(['submission_feature_id', 'uuid', 'parent_uuid', 'name']);

      // Both passthrough rows are emitted, with their values intact.
      expect(rows.length).to.equal(2);
      const nameIndex = header.indexOf('name');
      const uuidIndex = header.indexOf('uuid');
      expect(rows.map((row) => row[uuidIndex]).sort((a, b) => a.localeCompare(b))).to.eql(['ds-uuid-1', 'ds-uuid-2']);
      expect(rows.map((row) => row[nameIndex]).sort((a, b) => a.localeCompare(b))).to.eql(['Survey One', 'Survey Two']);
    });

    it('fails fast on an over-budget dimension before buffering or uploading (Edge 4 getRowCount preflight)', async () => {
      const { downloadVersionId } = await seedReadyDownloadWithParquetArtifact(['survey', 'animal']);
      const { groupId } = await seedPendingExport(downloadVersionId, surveyAnimalConfig());

      const upload = stubUploadCapture();
      // The dimension `animal` DECLARES one row over the in-memory join budget but
      // serves an EMPTY cursor. A correct footer-only preflight rejects on the
      // declared count alone, before reading (and buffering) a single row — so the
      // empty cursor is what makes this prove the preflight, not merely the cap: had
      // the guard buffered first, it would have seen zero rows and never thrown.
      stubParquetReadersByType(
        {
          survey: [{ submission_feature_id: 1, uuid: 'ds-uuid-1', parent_uuid: null, name: 'Survey One' }],
          animal: []
        },
        { animal: DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS + 1 }
      );

      // The build side throws (retry-as-lifecycle: the terminal FAILED transition is
      // the pg-boss DLQ's job, not runExportGroup's), and the message steers the
      // client to the raw-Parquet download path.
      let caught: Error | undefined;
      try {
        await pipelineService.runExportGroup(groupId);
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(caught?.message).to.include('in-memory join budget');

      // Build-side rejection happens before any archiver/part opens → nothing uploaded.
      expect([...upload.captured.keys()], 'no part-zip uploaded for an over-budget dimension').to.eql([]);

      // No artifact rows landed (the export never reached the write/finalize stage).
      const joinRows = await connection.sql(SQL`
        SELECT dvea.download_version_export_artifact_id
        FROM download_version_export_artifact dvea
        WHERE dvea.download_version_export_artifact_group_id = ${groupId}
          AND dvea.record_end_date IS NULL;
      `);
      expect(joinRows.rowCount).to.equal(0);

      // PROCESSING landed but READY never fired — terminal FAILED is the DLQ's job.
      const groupRow = await connection.sql(SQL`
        SELECT status FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(groupRow.rows[0].status).to.equal(DownloadStatusEnum.PROCESSING);
    });

    it('chained two-step merge resolves the downstream join key through the prefixed middle type (Edge 5)', async () => {
      const { downloadId, downloadVersionId } = await seedReadyDownloadWithParquetArtifact([
        'survey',
        'animal',
        'capture'
      ]);

      // Two-hop downward star chain: survey → animal → capture.
      //   step 1  animal.parent_uuid = survey.uuid   (root finds its animals)
      //   step 2  capture.parent_uuid = animal.uuid    (each animal finds its captures)
      // Step 2's LEFT key is `animal.uuid` — but after step 1, animal's columns live
      // on the joined row PREFIXED as `animal_uuid` (mergePrefixed). The engine must
      // (a) read the left key at its prefixed name for a non-root left side, and
      // (b) have kept `animal.uuid` in animal's build-side projection PURELY because
      // it is a downstream step's left column (it is neither animal's own probe key
      // nor one of its output columns). Break either and step 2 probes an empty key
      // and every capture goes unmatched — so `capture_uuid` populating end-to-end is
      // the proof both hold.
      const config = ExportConfig.parse({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'survey',
        feature_types: ['survey', 'animal', 'capture'],
        merge_steps: [
          {
            left_feature_type: 'survey',
            left_column: 'uuid',
            right_feature_type: 'animal',
            right_column: 'parent_uuid',
            merge_type: 'left'
          },
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'capture',
            right_column: 'parent_uuid',
            merge_type: 'left'
          }
        ],
        output_columns: [
          { feature_type: 'survey', column: 'name' },
          { feature_type: 'animal', column: 'animal_identifier' },
          { feature_type: 'capture', column: 'uuid' }
        ]
      });
      const { groupId } = await seedPendingExport(downloadVersionId, config);

      const upload = stubUploadCapture();
      stubParquetReadersByType({
        survey: [{ submission_feature_id: 1, uuid: 'ds-1', parent_uuid: null, name: 'Survey One' }],
        animal: [
          // an-1 has a capture; an-2 has none (proves left-join keep at the FAR hop).
          { submission_feature_id: 10, uuid: 'an-1', parent_uuid: 'ds-1', animal_identifier: 'ANIMAL-1' },
          { submission_feature_id: 11, uuid: 'an-2', parent_uuid: 'ds-1', animal_identifier: 'ANIMAL-2' }
        ],
        capture: [{ submission_feature_id: 20, uuid: 'cap-1', parent_uuid: 'an-1' }]
      });

      await pipelineService.runExportGroup(groupId);

      const groupRow = await connection.sql(SQL`
        SELECT status FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(groupRow.rows[0].status).to.equal(DownloadStatusEnum.READY);

      const partKey = part1Key(downloadId, downloadVersionId, groupId);
      const { header, rows } = parseCsv(upload.csvEntries(partKey)[0].text);
      expect(header).to.eql(['survey_name', 'animal_animal_identifier', 'capture_uuid']);

      // Hop 1 fanned the one survey out to its two animals; hop 2 resolved cap-1
      // through the prefixed `animal_uuid` for an-1, and left-join-kept an-2 (no
      // capture) with an empty far-hop cell.
      const byAnimal = [...rows].sort((a, b) => a[1].localeCompare(b[1]));
      expect(byAnimal.length).to.equal(2);
      expect(byAnimal[0]).to.eql(['Survey One', 'ANIMAL-1', 'cap-1']);
      expect(byAnimal[1]).to.eql(['Survey One', 'ANIMAL-2', '']);
    });
  });
});
