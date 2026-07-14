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
import { ApiValidationError } from '../../errors/api-error';
import { ExportConfig } from '../../models/download-export-config';
import { DownloadStatusEnum } from '../../models/download-status';
import { CreateDownloadVersionExportRequest } from '../../models/download-version-export';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadExportService } from '../../services/download/download-export-service';
import { DownloadService } from '../../services/download/download-service';
import { BucketType, ObjectStorageService } from '../../services/object-storage/object-storage-service';
import { ArtifactService } from '../../services/upload/artifact-service';
import { canonicalizeExportConfig, computeConfigHash } from '../../utils/export-config-utils';

/**
 * Build a minimal-but-valid `per_feature_type` export recipe over the given
 * feature types. References only the always-present structural columns
 * (`submission_feature_id` / `uuid` / `parent_uuid`), so the recipe passes
 * `validateExportConfig` regardless of each type's schema — the only data-aware
 * requirement is that the types are materialized for the download, which the
 * seed helper guarantees.
 */
function validPerTypeConfig(downloadVersionId: string, featureTypes: string[]): CreateDownloadVersionExportRequest {
  return {
    download_version_id: downloadVersionId,
    version: 1,
    export_type: 'csv',
    mode: 'per_feature_type',
    feature_types: featureTypes,
    merge_steps: [],
    output_columns: featureTypes.map((feature_type) => ({ feature_type, column: 'uuid' }))
  };
}

/**
 * The `config_hash` the service computes for a given request body — canonicalize
 * the recipe (stripping the packaging knob) then hash. Lets the dedupe-key
 * assertions read the active group exactly as the resolver keys it.
 */
function hashForConfig(request: CreateDownloadVersionExportRequest): string {
  // Drop the packaging knob (max_part_size_bytes) before hashing, mirroring the
  // service's dedupe key.
  const rawConfig = { ...request };
  delete rawConfig.max_part_size_bytes;
  return computeConfigHash(canonicalizeExportConfig(ExportConfig.parse(rawConfig)));
}

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
    featureTypeNames: string[] = ['survey']
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
      expression: null,
      requestedBy: systemUserId
    });

    // createDownloadRequest already materialized the current version — resolve it.
    const download = await downloadRepo.findDownloadById(downloadId);
    const downloadVersionId = download!.download_version_id;

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
        object_key: `downloads/${downloadId}/versions/${downloadVersionId}/${featureTypeName}/data.parquet`,
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
   * Count the active groups (record_end_date IS NULL) matching the dedupe key for
   * a version + `config_hash` — proves the active-uniqueness invariant from raw
   * SQL, independent of the resolver. The dedupe key is now keyed on
   * `config_hash` (NOT `format`/`mode`), so a denormalized config and a per-type
   * config against the same version are distinct keys and counted separately.
   */
  async function countActiveGroups(downloadVersionId: string, configHash: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS n
      FROM download_version_export_artifact_group
      WHERE download_version_id = ${downloadVersionId}
        AND config_hash = ${configHash}
        AND max_part_size_bytes = ${MAX_PART}
        AND exporter_version = ${EXPORTER_VERSION}
        AND record_end_date IS NULL;
    `);
    return result.rows[0].n;
  }

  /**
   * Count ALL active groups (record_end_date IS NULL) for a version regardless of
   * config_hash — used to prove that two DIFFERENT configs each get their own
   * active group, and that an identical config does NOT spawn a second one.
   */
  async function countAllActiveGroups(downloadVersionId: string): Promise<number> {
    const result = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS n
      FROM download_version_export_artifact_group
      WHERE download_version_id = ${downloadVersionId}
        AND record_end_date IS NULL;
    `);
    return result.rows[0].n;
  }

  // ── New combination → one job ────────────────────────────────────────

  describe('new export shape', () => {
    it('materializes exactly one active group, one attached export, and enqueues one job', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();
      const publishStub = stubPublish();

      const config = validPerTypeConfig(downloadVersionId, ['survey']);
      const record = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);

      // Exactly one active group exists for the shape.
      expect(await countActiveGroups(downloadVersionId, hashForConfig(config))).to.equal(1);

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

      // The group persisted the recipe (config JSONB + config_hash) and the
      // denormalized format/mode columns; the config round-trips back through the
      // Zod model (proving the JSONB stored a valid ExportConfig, not a partial).
      expect(group.format).to.equal('csv');
      expect(group.mode).to.equal('per_feature_type');
      expect(group.config_hash).to.equal(hashForConfig(config));
      expect(group.config.mode).to.equal('per_feature_type');
      expect(group.config.feature_types).to.eql(['survey']);

      // Raw read-back of the JSONB column confirms it was written (not null) and
      // matches the canonical hash the service keyed the group on.
      const rawGroup = await connection.sql(SQL`
        SELECT config, config_hash, format, mode
        FROM download_version_export_artifact_group
        WHERE download_version_export_artifact_group_id = ${groupId};
      `);
      expect(rawGroup.rows[0].config).to.not.be.null;
      expect(rawGroup.rows[0].config_hash).to.equal(hashForConfig(config));
      expect(rawGroup.rows[0].format).to.equal('csv');
      expect(rawGroup.rows[0].mode).to.equal('per_feature_type');

      // One job published, carrying the group id.
      expect(publishStub.calledOnce).to.be.true;
      expect(publishStub.firstCall.args[1]).to.deep.equal({ downloadVersionExportArtifactGroupId: groupId });
    });
  });

  // ── Distinct config → distinct active group ──────────────────────────

  describe('distinct config materializes a distinct group', () => {
    it('two configs with different config_hash get two separate active groups on the same version', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact([
        'survey',
        'animal'
      ]);

      // Config A exports one type; config B exports both — different recipes, so
      // different canonical hashes.
      const configA = validPerTypeConfig(downloadVersionId, ['survey']);
      const configB = validPerTypeConfig(downloadVersionId, ['survey', 'animal']);
      expect(hashForConfig(configA)).to.not.equal(hashForConfig(configB));

      const firstPublish = stubPublish();
      const a = await exportService.createDownloadVersionExport(downloadId, systemUserId, configA, connection);
      firstPublish.restore();

      const secondPublish = stubPublish();
      const b = await exportService.createDownloadVersionExport(downloadId, systemUserId, configB, connection);

      const groupA = await readGroupIdForExport(a.download_version_export_id);
      const groupB = await readGroupIdForExport(b.download_version_export_id);

      // Distinct configs → distinct groups, each its own active row, two total.
      expect(groupA).to.not.equal(groupB);
      expect(await countActiveGroups(downloadVersionId, hashForConfig(configA))).to.equal(1);
      expect(await countActiveGroups(downloadVersionId, hashForConfig(configB))).to.equal(1);
      expect(await countAllActiveGroups(downloadVersionId)).to.equal(2);

      // Config B is genuinely new work → its own enqueue.
      expect(secondPublish.calledOnce).to.be.true;
      expect(secondPublish.firstCall.args[1]).to.deep.equal({ downloadVersionExportArtifactGroupId: groupB });
    });
  });

  // ── Denormalized config materializes a denormalized group ────────────

  describe('denormalized config', () => {
    it('materializes a group with mode=denormalized and attaches the export', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact([
        'survey',
        'animal'
      ]);

      // A valid denormalized recipe rooted at `survey`, joining `animal` on the
      // always-present structural keys (parent_uuid → uuid). No schema columns
      // referenced, so it passes validation regardless of each type's properties.
      const config: CreateDownloadVersionExportRequest = {
        download_version_id: downloadVersionId,
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
          { feature_type: 'animal', column: 'parent_uuid' }
        ]
      };

      const publishStub = stubPublish();
      const record = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      const groupId = await readGroupIdForExport(record.download_version_export_id);

      const group = await exportRepo.getExportArtifactGroupById(groupId);
      expect(group.mode).to.equal('denormalized');
      expect(group.config.mode).to.equal('denormalized');
      expect(group.config.root_feature_type).to.equal('survey');
      expect(group.config_hash).to.equal(hashForConfig(config));
      expect(record.mode).to.equal('denormalized');

      // Exactly one active group for the denormalized config, and new work enqueued.
      expect(await countActiveGroups(downloadVersionId, hashForConfig(config))).to.equal(1);
      expect(publishStub.calledOnce).to.be.true;
    });
  });

  // ── Invalid config rejects clean (no group, no export, no job) ───────

  /**
   * Read-back probe: prove the failed request left NOTHING behind — no active
   * group, no export row attached to this version. Run from raw SQL so it is
   * independent of the resolver path.
   */
  async function assertNothingPersisted(downloadVersionId: string): Promise<void> {
    const groups = await connection.sql(SQL`
      SELECT download_version_export_artifact_group_id
      FROM download_version_export_artifact_group
      WHERE download_version_id = ${downloadVersionId};
    `);
    expect(groups.rowCount, 'no artifact group should be created for an invalid config').to.equal(0);

    const exports = await connection.sql(SQL`
      SELECT download_version_export_id
      FROM download_version_export
      WHERE download_version_id = ${downloadVersionId};
    `);
    expect(exports.rowCount, 'no download_version_export row should be created for an invalid config').to.equal(0);
  }

  /**
   * Drive the create through the service and assert it rejected with
   * `ApiValidationError` (HTTP400). Returns nothing — the caller then proves no
   * group/export/job leaked. try/catch (not chai-as-promised, which this repo
   * does not register) mirrors the existing `illegal transition` test's style.
   */
  async function expectValidationRejection(
    downloadId: string,
    systemUserId: number,
    config: CreateDownloadVersionExportRequest
  ): Promise<void> {
    try {
      await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      expect.fail('Expected ApiValidationError for an invalid export config');
    } catch (error) {
      expect(error).to.be.instanceOf(ApiValidationError);
    }
  }

  describe('invalid config validation (AC8)', () => {
    it('rejects a config referencing a non-materialized feature type with ApiValidationError', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact(['survey']);
      const publishStub = stubPublish();

      // 'observation' was never materialized for this download.
      const config = validPerTypeConfig(downloadVersionId, ['observation']);

      await expectValidationRejection(downloadId, systemUserId, config);

      await assertNothingPersisted(downloadVersionId);
      expect(publishStub.notCalled, 'no job should be published for an invalid config').to.be.true;
    });

    it('rejects a config referencing a non-existent column with ApiValidationError', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact(['survey']);
      const publishStub = stubPublish();

      // 'survey' is materialized but 'no_such_column' is neither structural nor a schema property.
      const config: CreateDownloadVersionExportRequest = {
        download_version_id: downloadVersionId,
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['survey'],
        merge_steps: [],
        output_columns: [{ feature_type: 'survey', column: 'no_such_column' }]
      };

      await expectValidationRejection(downloadId, systemUserId, config);

      await assertNothingPersisted(downloadVersionId);
      expect(publishStub.notCalled, 'no job should be published for an invalid config').to.be.true;
    });

    it('rejects a config whose merge steps are unreachable from the root with ApiValidationError', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact([
        'survey',
        'animal'
      ]);
      const publishStub = stubPublish();

      // Root is `survey`, but the only merge step joins FROM `animal` — which is
      // never made reachable from the root (no step has `survey` on its left). The
      // step is orphaned, so orderMergeSteps throws the cycle/unreachable error
      // inside validateExportConfig (same throw a true cycle produces). All types
      // and structural columns referenced exist, so this is the only error.
      const config: CreateDownloadVersionExportRequest = {
        download_version_id: downloadVersionId,
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'survey',
        feature_types: ['survey', 'animal'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'survey',
            right_column: 'parent_uuid',
            merge_type: 'left'
          }
        ]
      };

      await expectValidationRejection(downloadId, systemUserId, config);

      await assertNothingPersisted(downloadVersionId);
      expect(publishStub.notCalled, 'no job should be published for an invalid config').to.be.true;
    });
  });

  // ── Ready reuse → no job ─────────────────────────────────────────────

  describe('reuse of a ready group', () => {
    it('attaches a second export to the same ready group and does not re-enqueue', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();
      const config = validPerTypeConfig(downloadVersionId, ['survey']);
      const configHash = hashForConfig(config);

      // First request materializes the group.
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      expect(firstPublish.calledOnce).to.be.true;
      const groupId = await readGroupIdForExport(first.download_version_export_id);
      firstPublish.restore();

      // Drive the group to `ready` (pipeline finished).
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.READY, {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      // Second identical request resolves to the same config_hash → reuses the ready group.
      const secondPublish = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);

      // Still exactly one active group for the config_hash, and none other on the version.
      expect(await countActiveGroups(downloadVersionId, configHash)).to.equal(1);
      expect(await countAllActiveGroups(downloadVersionId)).to.equal(1);

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
      const config = validPerTypeConfig(downloadVersionId, ['survey']);

      // First request leaves the group `pending` (a run is in flight).
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      const groupId = await readGroupIdForExport(first.download_version_export_id);
      firstPublish.restore();

      // Move it to `processing` — still an in-flight (non-failed, non-ready) state.
      await exportRepo.updateExportArtifactGroupStatus(groupId, DownloadStatusEnum.PROCESSING, {
        started_at: new Date().toISOString()
      });

      // Second request rides the in-flight group.
      const secondPublish = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);

      expect(await countActiveGroups(downloadVersionId, hashForConfig(config))).to.equal(1);
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

      const config = validPerTypeConfig(downloadVersionId, ['survey']);
      const normalized = canonicalizeExportConfig(ExportConfig.parse(config));
      const configHash = computeConfigHash(normalized);
      const payload = {
        downloadVersionId,
        config: normalized,
        configHash,
        format: normalized.export_type,
        mode: normalized.mode,
        maxPartSizeBytes: MAX_PART,
        exporterVersion: EXPORTER_VERSION
      };

      // No active group yet.
      expect(await exportRepo.findActiveExportArtifactGroup(downloadVersionId, configHash, MAX_PART, EXPORTER_VERSION))
        .to.be.null;

      // First insert wins → returns true (this call created the group).
      expect(await exportRepo.createExportArtifactGroup(payload)).to.be.true;

      // Second identical insert collides on the partial-unique key → ON CONFLICT
      // DO NOTHING. rowCount 0 is valid; it must NOT throw and must report false
      // (did NOT insert) so the caller skips enqueuing a duplicate job.
      expect(await exportRepo.createExportArtifactGroup(payload)).to.be.false;

      // Re-select returns exactly the one winner.
      expect(await countActiveGroups(downloadVersionId, configHash)).to.equal(1);
      const winner = await exportRepo.findActiveExportArtifactGroup(
        downloadVersionId,
        configHash,
        MAX_PART,
        EXPORTER_VERSION
      );
      expect(winner).to.not.be.null;
      const winnerGroupId = winner!.download_version_export_artifact_group_id;

      // Two export requests through the service both converge on the winner group.
      const publishStub = stubPublish();
      const a = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      const b = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);

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
      const config = validPerTypeConfig(downloadVersionId, ['survey']);

      // First request materializes the group, then we drive it to `failed`.
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      const failedGroupId = await readGroupIdForExport(first.download_version_export_id);
      firstPublish.restore();

      await exportRepo.updateExportArtifactGroupStatus(failedGroupId, DownloadStatusEnum.FAILED, {
        completed_at: new Date().toISOString(),
        error_message: 'boom'
      });

      // Second request must end the dead group and build a fresh one.
      const publishStub = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
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
      expect(await countActiveGroups(downloadVersionId, hashForConfig(config))).to.equal(1);

      // Genuinely new work → one job.
      expect(publishStub.calledOnce).to.be.true;
      expect(publishStub.firstCall.args[1]).to.deep.equal({ downloadVersionExportArtifactGroupId: freshGroupId });
    });
  });

  // ── exporter_version bump invalidates stale ready ────────────────────

  describe('exporter_version invalidation', () => {
    it('ignores a ready group at a stale exporter_version and builds a fresh group at the current version', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();
      const config = validPerTypeConfig(downloadVersionId, ['survey']);
      const normalized = canonicalizeExportConfig(ExportConfig.parse(config));
      const configHash = computeConfigHash(normalized);

      // Seed a `ready` group at exporter_version 0 (one less than the current
      // EXPORTER_VERSION=1) carrying the SAME config_hash the service will compute —
      // so the only difference is the exporter_version. The repo helper always
      // stamps EXPORTER_VERSION, so the stale-version row must be inserted via raw
      // SQL. config/config_hash are NOT NULL, so they are supplied here too.
      const staleVersion = EXPORTER_VERSION - 1;
      const staleInsert = await connection.sql(SQL`
        INSERT INTO download_version_export_artifact_group
          (download_version_id, format, mode, max_part_size_bytes, exporter_version, status, started_at, completed_at, config, config_hash)
        VALUES (
          ${downloadVersionId}, ${FORMAT}, ${MODE}, ${MAX_PART}, ${staleVersion}, ${DownloadStatusEnum.READY},
          now(), now(), ${JSON.stringify(normalized)}::jsonb, ${configHash}
        )
        RETURNING download_version_export_artifact_group_id;
      `);
      const staleGroupId = staleInsert.rows[0].download_version_export_artifact_group_id;

      // The service probes at EXPORTER_VERSION=1 → misses the v0 group despite the matching config_hash.
      const publishStub = stubPublish();
      const record = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
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
      expect(download!.download_version_id).to.equal(downloadVersionId);

      // Parquet pipeline link path: createDownloadVersionArtifact writes a
      // download_version_artifact row keyed to the version.
      const { artifact_id } = await artifactService.insertArtifact({
        bucket: 'test-bucket',
        object_key: `downloads/${downloadId}/versions/${downloadVersionId}/survey/data.parquet`,
        byte_size: 2048,
        artifact_status: 'uploaded',
        checksum_sha256: 'b'.repeat(64),
        uploaded_at: new Date().toISOString(),
        format: 'parquet'
      });
      await versionRepo.createDownloadVersionArtifact(downloadVersionId, artifact_id, 'survey');

      const linkRows = await connection.sql(SQL`
        SELECT download_version_id, artifact_id, feature_type_name
        FROM download_version_artifact
        WHERE download_version_id = ${downloadVersionId}
          AND artifact_id = ${artifact_id}
          AND record_end_date IS NULL;
      `);
      expect(linkRows.rowCount).to.equal(1);
      expect(linkRows.rows[0].feature_type_name).to.equal('survey');
    });
  });

  // ── Part-URL resolution through the group ────────────────────────────

  describe('part-URL resolution', () => {
    it('orders parts by chunk_id, filters null byte_size, and signs the GROUP key while naming the file by download + version id', async () => {
      const { downloadId, downloadVersionId, systemUserId } = await seedReadyDownloadWithVersionArtifact();

      // Materialize a group + export via the service.
      const publishStub = stubPublish();
      const record = await exportService.createDownloadVersionExport(
        downloadId,
        systemUserId,
        validPerTypeConfig(downloadVersionId, ['survey']),
        connection
      );
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
      const config = validPerTypeConfig(downloadVersionId, ['survey']);

      // Two requests attach to one group.
      const firstPublish = stubPublish();
      const first = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
      firstPublish.restore();
      const groupId = await readGroupIdForExport(first.download_version_export_id);

      const secondPublish = stubPublish();
      const second = await exportService.createDownloadVersionExport(downloadId, systemUserId, config, connection);
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

  // ── Migration cutover (schema) ───────────────────────────────────────
  // AC #13: the direct download_export → artifact behaviour is REPLACED, not
  // aliased. Assert the three legacy tables are dropped and the five new
  // version/export tables exist, plus the active-uniqueness partial index —
  // the structural guarantee behind the resolver race (AC #9): without an
  // index matching `ON CONFLICT (...) WHERE record_end_date IS NULL`, that
  // guard throws instead of collapsing concurrent duplicates.
  describe('migration cutover (schema)', () => {
    it('replaces the three legacy direct-export tables with the five version/export tables', async () => {
      const result = await connection.sql(SQL`
        SELECT
          to_regclass('biohub.download_export')                         AS legacy_download_export,
          to_regclass('biohub.download_artifact')                       AS legacy_download_artifact,
          to_regclass('biohub.download_export_artifact')                AS legacy_download_export_artifact,
          to_regclass('biohub.download_version')                        AS download_version,
          to_regclass('biohub.download_version_artifact')               AS download_version_artifact,
          to_regclass('biohub.download_version_export')                 AS download_version_export,
          to_regclass('biohub.download_version_export_artifact_group')  AS download_version_export_artifact_group,
          to_regclass('biohub.download_version_export_artifact')        AS download_version_export_artifact;
      `);
      const row = result.rows[0];

      // Legacy tables are gone (to_regclass returns null for a missing relation).
      expect(row.legacy_download_export, 'download_export should be dropped').to.be.null;
      expect(row.legacy_download_artifact, 'download_artifact should be dropped').to.be.null;
      expect(row.legacy_download_export_artifact, 'download_export_artifact should be dropped').to.be.null;

      // The five new tables exist.
      expect(row.download_version, 'download_version should exist').to.not.be.null;
      expect(row.download_version_artifact, 'download_version_artifact should exist').to.not.be.null;
      expect(row.download_version_export, 'download_version_export should exist').to.not.be.null;
      expect(row.download_version_export_artifact_group, 'download_version_export_artifact_group should exist').to.not
        .be.null;
      expect(row.download_version_export_artifact, 'download_version_export_artifact should exist').to.not.be.null;
    });

    it('keys the active-group partial unique index on config_hash, with format/mode dropped from it', async () => {
      // The nuk1 swap (this ticket) re-keyed the active-uniqueness index from
      // (download_version_id, format, mode, max_part_size_bytes, exporter_version)
      // to (download_version_id, config_hash, max_part_size_bytes, exporter_version):
      // config_hash now stands in for the full recipe, so two recipes that differ
      // only in format/mode-derived shape collide iff their hashes collide.
      const result = await connection.sql(SQL`
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'biohub'
          AND tablename = 'download_version_export_artifact_group'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexdef ILIKE '%record_end_date IS NULL%';
      `);

      expect(result.rowCount, 'a partial unique index (WHERE record_end_date IS NULL) should exist').to.be.greaterThan(
        0
      );

      const def = result.rows.map((r) => r.indexdef).join('\n');

      // The new dedupe key columns are all present.
      for (const col of ['download_version_id', 'config_hash', 'max_part_size_bytes', 'exporter_version']) {
        expect(def, `the active-uniqueness index should cover ${col}`).to.include(col);
      }

      // The active-uniqueness index def references columns inside the index list
      // only — so format/mode appearing here would mean they are still part of the
      // dedupe key. They must be ABSENT now (folded into config_hash).
      expect(def, 'format must not be part of the active-uniqueness index').to.not.match(/\bformat\b/);
      expect(def, 'mode must not be part of the active-uniqueness index').to.not.match(/\bmode\b/);
    });
  });
});
