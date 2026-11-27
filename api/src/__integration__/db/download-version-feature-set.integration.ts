// Integration test for the download version feature set — verifies the schema contract (the
// feature_ids roaringbitmap column on download_version, NULL for a version that has no stored set)
// and that writes to download_version leave no audit_log journal rows while the audit columns are
// still filled.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running, migrations applied)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';

describe('Download version feature set (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let pipelineService: DownloadPipelineService;
  let downloadService: DownloadService;
  let policyService: DownloadPolicyService;
  let versionRepo: DownloadVersionRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    pipelineService = new DownloadPipelineService(connection);
    downloadService = new DownloadService(connection);
    policyService = new DownloadPolicyService(connection);
    versionRepo = new DownloadVersionRepository(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Create a download policy, a download and its version, the way download-service.integration.ts
   * does: no feature set is stored, which is the shape of a version built before the change.
   */
  async function createPolicyDownload(): Promise<{ download_id: string; download_version_id: string }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: `Feature set policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    const version = await versionRepo.createDownloadVersion(download_id);

    return { download_id, download_version_id: version.download_version_id };
  }

  /**
   * Read the audit_log rows the journal trigger wrote for the given version. The trigger writes
   * `table_name` as `<schema>.<table>` and the whole row as JSON, so the version id is in
   * `after_value` (insert, update) or `before_value` (update, delete).
   */
  async function getJournalOperations(downloadVersionId: string): Promise<string[]> {
    const result = await connection.sql(SQL`
      SELECT operation
      FROM audit_log
      WHERE table_name = 'biohub.download_version'
        AND (
          after_value->>'download_version_id' = ${downloadVersionId}
          OR before_value->>'download_version_id' = ${downloadVersionId}
        )
      ORDER BY audit_log_id;
    `);

    return result.rows.map((row) => row.operation);
  }

  async function getTriggerNames(): Promise<string[]> {
    const result = await connection.sql(SQL`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'biohub.download_version'::regclass
        AND NOT tgisinternal
      ORDER BY tgname;
    `);

    return result.rows.map((row) => row.tgname);
  }

  // ── Tests ────────────────────────────────────────────────────────────

  it('AC7 download_version has a nullable feature_ids roaringbitmap column with no default', async () => {
    const columns = await connection.sql(SQL`
      SELECT is_nullable, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'biohub'
        AND table_name = 'download_version'
        AND column_name = 'feature_ids'
    `);

    expect(columns.rows, 'biohub.download_version.feature_ids column').to.have.length(1);
    expect(columns.rows[0].udt_name).to.equal('roaringbitmap');
    expect(columns.rows[0].is_nullable).to.equal('YES');
    expect(columns.rows[0].column_default, 'column default').to.equal(null);
  });

  it('AC7 a version inserted with no feature set has NULL feature_ids and getDownloadVersion returns it as before', async () => {
    const { download_id, download_version_id } = await createPolicyDownload();

    const stored = await connection.sql(SQL`
      SELECT
        feature_ids IS NULL AS feature_ids_is_null,
        rb_cardinality(feature_ids) AS cardinality
      FROM download_version
      WHERE download_version_id = ${download_version_id};
    `);

    expect(stored.rows, 'download_version row').to.have.length(1);
    expect(stored.rows[0].feature_ids_is_null, 'feature_ids IS NULL').to.equal(true);
    expect(stored.rows[0].cardinality, 'rb_cardinality(feature_ids)').to.equal(null);

    const version = await downloadService.getDownloadVersion(download_id, download_version_id);

    expect(version.download_version_id).to.equal(download_version_id);
    expect(version.download_id).to.equal(download_id);
    expect(version.status).to.equal(DownloadStatusEnum.PENDING);
    expect(version.feature_count).to.equal(null);
    expect(version.started_at).to.equal(null);
    expect(version.completed_at).to.equal(null);
    expect(version.materialized_at).to.equal(null);
    expect(version.error_message).to.equal(null);
    expect(version.create_date).to.be.a('string');
  });

  it('AC10 creating a version and moving it to processing writes no audit_log row for download_version', async () => {
    const { download_id, download_version_id } = await createPolicyDownload();

    await pipelineService.transitionDownloadVersionStatus(download_version_id, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);

    // Fixture check: the insert and the update both happened.
    const version = await downloadService.getDownloadVersion(download_id, download_version_id);
    expect(version.status).to.equal(DownloadStatusEnum.PROCESSING);

    expect(await getJournalOperations(download_version_id), 'audit_log rows for the version').to.eql([]);
  });

  it('AC10 create_user, update_user and update_date are set after the version is created and updated', async () => {
    const { download_version_id } = await createPolicyDownload();

    await pipelineService.transitionDownloadVersionStatus(download_version_id, DownloadStatusEnum.PROCESSING, [
      DownloadStatusEnum.PENDING
    ]);

    const result = await connection.sql(SQL`
      SELECT create_user, update_user, update_date
      FROM download_version
      WHERE download_version_id = ${download_version_id};
    `);

    expect(result.rows, 'download_version row').to.have.length(1);
    expect(result.rows[0].create_user).to.equal(connection.systemUserId());
    expect(result.rows[0].update_user).to.equal(connection.systemUserId());
    expect(result.rows[0].update_date, 'update_date').to.not.equal(null);
  });

  it('AC10 download_version keeps the audit_download_version trigger and has no journal_download_version trigger', async () => {
    const triggerNames = await getTriggerNames();

    expect(triggerNames).to.include('audit_download_version');
    expect(triggerNames).to.not.include('journal_download_version');
  });
});
