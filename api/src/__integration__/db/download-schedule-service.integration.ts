// Integration test for the recurring download-schedule feature — verifies the real
// SQL/constraint behavior mocks can't reach: the partial unique index that caps a
// download at one active schedule, the now()-relative due filter, markRun advancing
// the recurrence, the FK ON DELETE CASCADE, and the end-to-end occurrence side effect
// (a due schedule mints exactly one new download_version).
//
// Pattern 1 (service + repository), transaction-rollback isolation — every test runs
// inside a transaction that is ROLLED BACK after each test, so nothing persists.
//
// SKIP LOCKED concurrency (claimDueSchedules' FOR UPDATE SKIP LOCKED) is intentionally
// NOT tested here. Observing a concurrent skip requires two connections with COMMITTED
// data fighting over the same row — that defeats rollback isolation and needs a brittle
// two-connection Pattern-3 system test. The at-most-once guarantee is instead covered
// by-design: scenario 7 proves markRun advances next_run_date out of the due window, and
// scenario 8 proves a due occurrence mints exactly one version. An optional follow-up is
// a labeled __integration__/system/ two-connection lock test.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { DownloadScheduleRepository } from '../../repositories/download/download-schedule-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadScheduleService } from '../../services/download/download-schedule-service';
import { DownloadService } from '../../services/download/download-service';

const CRON = '0 2 * * *';
const TIMEZONE = 'America/Vancouver';

describe('DownloadScheduleService (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let scheduleService: DownloadScheduleService;
  let scheduleRepo: DownloadScheduleRepository;
  let downloadService: DownloadService;
  let policyService: DownloadPolicyService;
  let versionRepo: DownloadVersionRepository;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    scheduleService = new DownloadScheduleService(connection);
    scheduleRepo = new DownloadScheduleRepository(connection);
    downloadService = new DownloadService(connection);
    policyService = new DownloadPolicyService(connection);
    versionRepo = new DownloadVersionRepository(connection);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: create a download policy + download row + its 1:1 version in one shot,
   * returning the download id and version id. Copied inline from
   * download-service.integration.ts (it is private there). The version is v1, so any
   * later rerun is the second version — the delta assertions below count on 1 → 2.
   */
  async function createPolicyDownload(): Promise<{
    download_id: string;
    policy_id: string;
    download_version_id: string;
  }> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: `Test policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      featureTypes: ['survey'],
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    const version = await versionRepo.createDownloadVersion(download_id);
    return { download_id, policy_id, download_version_id: version.download_version_id };
  }

  /**
   * Helper: seed a download_schedule row via raw SQL using DB-relative times so the due
   * filter compares against the same now() the query uses — no Node/PG clock skew, and
   * no dependence on the service's computeNextRunDate. `due: true` lands next_run_date in
   * the past (one hour ago); `due: false` lands it in the future. `disabled: true` stamps
   * record_end_date = now() so the row is soft-deleted. The audit trigger populates
   * create_user from the session user the harness establishes (same as the anchor).
   */
  async function seedSchedule(downloadId: string, opts: { due?: boolean; disabled?: boolean } = {}): Promise<number> {
    const nextRunOffset = opts.due ? "now() - interval '1 hour'" : "now() + interval '1 hour'";
    const recordEndDate = opts.disabled ? 'now()' : 'NULL';

    const sql = SQL`
      INSERT INTO download_schedule (download_id, cron_expression, timezone, next_run_date, record_end_date)
      VALUES (${downloadId}, ${CRON}, ${TIMEZONE}, `;
    // next_run_date and record_end_date are DB-relative SQL fragments (now() ± interval),
    // not bound params, so the due filter compares against the same now() the query uses.
    sql.append(nextRunOffset).append(', ').append(recordEndDate).append(SQL`)
      RETURNING download_schedule_id;
    `);

    const response = await connection.sql(sql);

    return response.rows[0].download_schedule_id;
  }

  /**
   * Helper: create a bare download (policy + download row, NO version). Used by the
   * cascade test, where the parent download must be deletable — download_version's FK is
   * NO ACTION, so a download carrying a version cannot be deleted, but its schedule still
   * must cascade away.
   */
  async function createBareDownload(): Promise<string> {
    const { policy_id } = await policyService.createDownloadPolicy({
      name: `Test policy ${Date.now()}-${randomUUID().slice(0, 8)}`,
      description: null,
      featureTypes: ['survey'],
      expressionId: null
    });
    const { download_id } = await downloadService.createDownload({
      policyId: policy_id,
      format: 'parquet',
      requestedBy: connection.systemUserId()
    });
    return download_id;
  }

  /** Helper: count active (record_end_date IS NULL) schedules for a download. */
  async function countActiveSchedules(downloadId: string): Promise<number> {
    const response = await connection.sql(SQL`
      SELECT count(*)::int AS count
      FROM download_schedule
      WHERE download_id = ${downloadId} AND record_end_date IS NULL;
    `);
    return response.rows[0].count;
  }

  /** Helper: count download_version rows for a download (for the rerun delta). */
  async function countVersions(downloadId: string): Promise<number> {
    const response = await connection.sql(SQL`
      SELECT count(*)::int AS count
      FROM download_version
      WHERE download_id = ${downloadId};
    `);
    return response.rows[0].count;
  }

  /**
   * Stub the pg-boss publish so reruns never reach the real queue from inside the
   * rolled-back transaction. The real createDownloadVersion INSERT still lands, so the
   * version-delta assertions exercise the actual side effect.
   */
  function stubPublish(): sinon.SinonStub {
    return sinon.stub(DownloadService.dependencies, 'publishProcessDownloadJob').resolves({
      status: 'published',
      jobId: 'job-1'
    });
  }

  // Scenario 1 — the partial unique index (download_schedule_nuk1) is the only thing that
  // blocks a second active schedule; mocks can't reproduce it.
  describe('partial unique index (download_schedule_nuk1)', () => {
    it('blocks a second active schedule for the same download', async () => {
      const { download_id } = await createPolicyDownload();
      await seedSchedule(download_id);

      // A unique violation poisons the surrounding transaction, so wrap the failing insert
      // in a SAVEPOINT and roll back to it — that releases the constraint error while
      // keeping the outer test transaction usable for the count assertion below. The raw
      // PG unique-violation is wrapped by parseError into ApiExecuteSQLError.
      await connection.sql(SQL`SAVEPOINT before_duplicate;`);
      try {
        await seedSchedule(download_id);
        expect.fail('Expected the partial unique index to reject a second active schedule');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        await connection.sql(SQL`ROLLBACK TO SAVEPOINT before_duplicate;`);
      }

      // The index (not the rollback) is what kept the second active row out.
      expect(await countActiveSchedules(download_id)).to.equal(1);
    });

    // Scenario 2 — the index keys only on active rows (WHERE record_end_date IS NULL), so a
    // re-insert after disable is allowed and leaves one active + one historical row.
    it('allows a re-insert after the active schedule is disabled', async () => {
      const { download_id } = await createPolicyDownload();
      const firstId = await seedSchedule(download_id);

      await scheduleRepo.disableSchedule(firstId);
      await seedSchedule(download_id);

      expect(await countActiveSchedules(download_id)).to.equal(1);
      const total = await connection.sql(SQL`
        SELECT count(*)::int AS count FROM download_schedule WHERE download_id = ${download_id};
      `);
      expect(total.rows[0].count).to.equal(2); // 1 active + 1 historical
    });
  });

  // Scenario 3 — the active filter's real NULL semantics.
  describe('findActiveScheduleByDownloadId', () => {
    it('returns the active row, then null after the schedule is disabled', async () => {
      const { download_id } = await createPolicyDownload();
      const scheduleId = await seedSchedule(download_id);

      const active = await scheduleRepo.findActiveScheduleByDownloadId(download_id);
      expect(active).to.not.be.null;
      expect(active!.download_schedule_id).to.equal(scheduleId);

      await scheduleRepo.disableSchedule(scheduleId);

      expect(await scheduleRepo.findActiveScheduleByDownloadId(download_id)).to.be.null;
    });
  });

  // Scenario 4 — updateDownloadSchedule re-points the recurrence forward but must NOT
  // rewrite run history. markRun runs FIRST so last_run_date is non-null; the assertion
  // would be vacuous against a fresh (null) row.
  describe('updateDownloadSchedule', () => {
    it('applies new cron/tz/next_run_date, preserves last_run_date, and keeps the row active', async () => {
      const { download_id } = await createPolicyDownload();
      const scheduleId = await seedSchedule(download_id);

      // Establish a non-null last_run_date before the update.
      await scheduleRepo.markRun(scheduleId, new Date('2999-01-01T00:00:00Z').toISOString());
      const before = await connection.sql(SQL`
        SELECT last_run_date FROM download_schedule WHERE download_schedule_id = ${scheduleId};
      `);
      const lastRunDate = before.rows[0].last_run_date;
      expect(lastRunDate).to.not.be.null;

      const newNextRun = new Date('2998-06-01T12:00:00Z').toISOString();
      await scheduleRepo.updateDownloadSchedule(scheduleId, {
        cron_expression: '30 4 * * 1',
        timezone: 'UTC',
        next_run_date: newNextRun
      });

      const after = await connection.sql(SQL`
        SELECT cron_expression, timezone, next_run_date, last_run_date, record_end_date
        FROM download_schedule WHERE download_schedule_id = ${scheduleId};
      `);
      const row = after.rows[0];
      expect(row.cron_expression).to.equal('30 4 * * 1');
      expect(row.timezone).to.equal('UTC');
      expect(new Date(row.next_run_date).toISOString()).to.equal(newNextRun);
      // last_run_date is preserved (still the markRun value, still non-null).
      expect(new Date(row.last_run_date).toISOString()).to.equal(new Date(lastRunDate).toISOString());
      expect(row.record_end_date).to.be.null;
    });
  });

  // Scenarios 5 & 6 — the due scan's now() filter + active filter + ORDER BY/LIMIT.
  describe('claimDueSchedules', () => {
    it('returns only schedules that are due AND active', async () => {
      const dueActive = await createPolicyDownload();
      const futureActive = await createPolicyDownload();
      const dueDisabled = await createPolicyDownload();

      const dueActiveId = await seedSchedule(dueActive.download_id, { due: true });
      await seedSchedule(futureActive.download_id, { due: false });
      await seedSchedule(dueDisabled.download_id, { due: true, disabled: true });

      const claimed = await scheduleRepo.claimDueSchedules(100);
      const ids = claimed.map((s) => s.download_schedule_id);

      expect(ids).to.include(dueActiveId); // past-active → claimed
      const downloadIds = claimed.map((s) => s.download_id);
      expect(downloadIds).to.not.include(futureActive.download_id); // future-active → excluded
      expect(downloadIds).to.not.include(dueDisabled.download_id); // disabled-but-past → excluded
    });

    it('orders by next_run_date ascending and honors the limit', async () => {
      const a = await createPolicyDownload();
      const b = await createPolicyDownload();
      const c = await createPolicyDownload();

      // Seed three due rows with strictly-increasing next_run_date (oldest first).
      const idOldest = await seedScheduleDueAt(a.download_id, "now() - interval '3 hours'");
      const idMiddle = await seedScheduleDueAt(b.download_id, "now() - interval '2 hours'");
      await seedScheduleDueAt(c.download_id, "now() - interval '1 hour'");

      const claimed = await scheduleRepo.claimDueSchedules(2);

      expect(claimed).to.have.length(2);
      expect(claimed[0].download_schedule_id).to.equal(idOldest);
      expect(claimed[1].download_schedule_id).to.equal(idMiddle);
    });
  });

  // Scenario 7 — markRun stamps last_run_date ≈ now() and advances next_run_date.
  // markRun targets by id only (no record_end_date guard) — it must be able to advance
  // a row regardless of active state. last_run_date is asserted with tolerance against
  // the DB clock (>= now() - 5s), not strict equality to a Node timestamp.
  describe('markRun', () => {
    it('sets last_run_date to ~now and advances next_run_date to the supplied value', async () => {
      const { download_id } = await createPolicyDownload();
      const scheduleId = await seedSchedule(download_id);

      const nextRun = new Date('2997-03-15T09:00:00Z').toISOString();
      await scheduleRepo.markRun(scheduleId, nextRun);

      const result = await connection.sql(SQL`
        SELECT
          (last_run_date >= now() - interval '5 seconds') AS last_run_recent,
          next_run_date
        FROM download_schedule
        WHERE download_schedule_id = ${scheduleId};
      `);
      expect(result.rows[0].last_run_recent).to.be.true;
      expect(new Date(result.rows[0].next_run_date).toISOString()).to.equal(nextRun);
    });
  });

  // Scenarios 8 & 9 — runDueSchedules end-to-end. The real createDownloadVersion INSERT
  // lands; only the queue publish is stubbed.
  describe('runDueSchedules', () => {
    it('mints exactly one new version, advances the schedule, and publishes once for a due schedule', async () => {
      const publishStub = stubPublish();
      const { download_id } = await createPolicyDownload();
      const scheduleId = await seedSchedule(download_id, { due: true });

      const versionsBefore = await countVersions(download_id); // v1 from createPolicyDownload
      expect(versionsBefore).to.equal(1);

      await scheduleService.runDueSchedules();

      // Exactly one new version (1 → 2).
      expect(await countVersions(download_id)).to.equal(2);

      // Schedule advanced out of the due window + a run recorded.
      const after = await connection.sql(SQL`
        SELECT
          (next_run_date > now()) AS advanced,
          last_run_date
        FROM download_schedule
        WHERE download_schedule_id = ${scheduleId};
      `);
      expect(after.rows[0].advanced).to.be.true;
      expect(after.rows[0].last_run_date).to.not.be.null;

      expect(publishStub.calledOnce).to.be.true;
    });

    it('is a no-op for a not-due schedule: no new version, next_run_date unchanged, no publish', async () => {
      const publishStub = stubPublish();
      const { download_id } = await createPolicyDownload();
      const scheduleId = await seedSchedule(download_id, { due: false });

      const nextRunBefore = await connection.sql(SQL`
        SELECT next_run_date FROM download_schedule WHERE download_schedule_id = ${scheduleId};
      `);

      await scheduleService.runDueSchedules();

      expect(await countVersions(download_id)).to.equal(1); // unchanged

      const nextRunAfter = await connection.sql(SQL`
        SELECT next_run_date FROM download_schedule WHERE download_schedule_id = ${scheduleId};
      `);
      expect(new Date(nextRunAfter.rows[0].next_run_date).toISOString()).to.equal(
        new Date(nextRunBefore.rows[0].next_run_date).toISOString()
      );

      expect(publishStub.called).to.be.false;
    });
  });

  // Scenario 10 — the FK's ON DELETE CASCADE. Deleting the parent download removes its
  // schedule rows; this is invisible to mocks and validates the Phase 1 cascade decision.
  describe('ON DELETE CASCADE from download', () => {
    it('removes the schedule when its parent download is deleted', async () => {
      // A bare download (no version) — download_version's FK is NO ACTION, so a download
      // with a version can't be deleted; the schedule's FK is the cascade under test.
      const download_id = await createBareDownload();
      await seedSchedule(download_id);

      await connection.sql(SQL`DELETE FROM download WHERE download_id = ${download_id};`);

      const remaining = await connection.sql(SQL`
        SELECT count(*)::int AS count FROM download_schedule WHERE download_id = ${download_id};
      `);
      expect(remaining.rows[0].count).to.equal(0);
    });
  });

  // Scenario 11 — upsertSchedule create → update against the real partial index. This test targets
  // the create-vs-update routing, not authorization (a route-level SystemRole gate). createPolicyDownload
  // inserts a real parent download, so the service's existence check passes without a stub. The
  // second call must route to UPDATE (same row) rather than tripping download_schedule_nuk1.
  describe('upsertSchedule create → update', () => {
    it('creates on first call, then updates the same active row on the second call', async () => {
      const { download_id } = await createPolicyDownload();

      const created = await scheduleService.upsertSchedule(download_id, {
        cron_expression: CRON
      });
      expect(await countActiveSchedules(download_id)).to.equal(1);

      const updated = await scheduleService.upsertSchedule(download_id, {
        cron_expression: '15 6 * * 3'
      });

      // Routed to UPDATE: still one active row, same id, new cron — no unique-index error.
      expect(await countActiveSchedules(download_id)).to.equal(1);
      expect(updated.download_schedule_id).to.equal(created.download_schedule_id);
      expect(updated.cron_expression).to.equal('15 6 * * 3');
      // The service fixes the zone server-side, so the persisted row always carries SCHEDULE_TIMEZONE.
      expect(updated.timezone).to.equal(TIMEZONE);
    });
  });

  /**
   * Helper: seed a due, active schedule with an explicit DB-relative next_run_date
   * offset (e.g. "now() - interval '3 hours'") so ordering tests can control relative
   * age without Node/PG clock skew.
   */
  async function seedScheduleDueAt(downloadId: string, nextRunOffset: string): Promise<number> {
    const sql = SQL`
      INSERT INTO download_schedule (download_id, cron_expression, timezone, next_run_date)
      VALUES (${downloadId}, ${CRON}, ${TIMEZONE}, `;
    sql.append(nextRunOffset).append(SQL`)
      RETURNING download_schedule_id;
    `);
    const response = await connection.sql(sql);
    return response.rows[0].download_schedule_id;
  }
});
