// Integration tests for SubmissionFeatureReconciliationService.reconcileAndActivateSubmissionUpload
// and the append-only submission_feature_log, against a real database.
//
// Covers: superseded transitions are logged (linked old -> new with both hashes) while new,
// unchanged, and re-approved uploads log nothing; multi-hop chain resolution; and the schema
// guards (uk1 one-transition-per-predecessor, ck1 removed-row shape). Each test seeds its own
// fixture and rolls back. Constraint-violation probes run LAST (a rejected statement poisons the
// transaction) — see expectConstraintViolation.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/submission-feature-reconciliation-service.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SubmissionFeatureReconciliationService } from '../../services/reconciliation/submission-feature-reconciliation-service';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

const FEATURE_TYPE_NAME = 'survey';
const SOURCE_ID = 'reconciliation-log-source-1';

// content_hash is a 64-char SHA-256 hex digest; any 64-char value satisfies the column.
const HASH_1 = 'a'.repeat(64);
const HASH_2 = 'b'.repeat(64);
const HASH_3 = 'c'.repeat(64);

/**
 * Assert a statement is rejected by the named constraint. Asserts OUTSIDE the catch so an
 * unexpected success surfaces the constraint name, not a misleading instanceof error; the
 * constraint is matched via the pg error message (the connection wrapper drops the code).
 * The rejected statement poisons the transaction, so call this only as the test's last statement.
 */
async function expectConstraintViolation(statement: Promise<unknown>, constraintDescription: string) {
  let caught: unknown;
  try {
    await statement;
  } catch (error) {
    caught = error;
  }

  expect(caught, `expected the statement to be rejected by ${constraintDescription}`).to.not.be.undefined;
  expect(caught).to.be.instanceOf(ApiExecuteSQLError);
  const dbError = (caught as ApiExecuteSQLError).errors?.[0] as { message?: string };
  expect(dbError.message).to.include(constraintDescription);
}

describe('SubmissionFeatureReconciliationService — activation and submission_feature_log (integration)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let service: SubmissionFeatureReconciliationService;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionFeatureReconciliationService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  // --- local fixture helpers -----------------------------------------------

  /** Create an upload with pending features already at `indexed`, the status the activation guard requires. */
  async function createIndexedUpload(
    submissionId: number,
    features: Array<{ source_id: string | null; content_hash?: string | null }>
  ): Promise<string> {
    return createTestUploadWithFeatures(connection, submissionId, FEATURE_TYPE_NAME, features, 'indexed');
  }

  /** Feature ids inserted under an upload, ascending. */
  async function getFeatureIdsByUpload(submissionUploadId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT submission_feature_id
      FROM submission_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY submission_feature_id;
    `);
    return result.rows.map((row) => row.submission_feature_id);
  }

  /**
   * Create an indexed upload carrying one feature for SOURCE_ID with the given content hash,
   * activate it, and return the ids involved plus the reconciliation outcome counts.
   */
  async function publishVersion(submissionId: number, contentHash: string) {
    const submissionUploadId = await createIndexedUpload(submissionId, [
      { source_id: SOURCE_ID, content_hash: contentHash }
    ]);
    const [submissionFeatureId] = await getFeatureIdsByUpload(submissionUploadId);
    const counts = await service.reconcileAndActivateSubmissionUpload(submissionUploadId);
    return { submissionUploadId, submissionFeatureId, counts };
  }

  /** All log rows for the fixture submission, ascending by id. */
  async function getLogRows(submissionId: number) {
    const result = await connection.sql(SQL`
      SELECT
        submission_id,
        submission_upload_id,
        feature_type_id,
        source_id,
        action::text AS action,
        previous_submission_feature_id,
        new_submission_feature_id,
        previous_content_hash,
        new_content_hash
      FROM submission_feature_log
      WHERE submission_id = ${submissionId}
      ORDER BY submission_feature_log_id;
    `);
    return result.rows;
  }

  async function getFeatureLifecycle(submissionFeatureId: number) {
    const result = await connection.sql(SQL`
      SELECT record_effective_date, record_end_date
      FROM submission_feature
      WHERE submission_feature_id = ${submissionFeatureId};
    `);
    return result.rows[0];
  }

  // --- tests ----------------------------------------------------------------

  it('logs superseded transitions with full linkage, and nothing for new, re-approved, or unchanged features', async () => {
    const submissionId = await createTestSubmission(connection);

    // Upload A publishes a brand new feature: not a transition, so nothing is logged.
    const versionA = await publishVersion(submissionId, HASH_1);
    expect(versionA.counts).to.eql({ new: 1, unchanged: 0, superseded: 0, conflict: 0 });
    expect(await getLogRows(submissionId)).to.have.length(0);

    // Upload B re-submits the same source with changed content: A is superseded by B.
    const versionB = await publishVersion(submissionId, HASH_2);
    expect(versionB.counts).to.eql({ new: 0, unchanged: 0, superseded: 1, conflict: 0 });

    const logRows = await getLogRows(submissionId);
    expect(logRows).to.have.length(1);
    expect(logRows[0]).to.include({
      submission_id: submissionId,
      submission_upload_id: versionB.submissionUploadId,
      source_id: SOURCE_ID,
      action: 'superseded',
      previous_submission_feature_id: versionA.submissionFeatureId,
      new_submission_feature_id: versionB.submissionFeatureId,
      previous_content_hash: HASH_1,
      new_content_hash: HASH_2
    });
    expect(logRows[0].feature_type_id).to.be.a('number');

    // The predecessor row is preserved (soft-ended), the replacement is active.
    const lifecycleA = await getFeatureLifecycle(versionA.submissionFeatureId);
    expect(lifecycleA.record_end_date).to.not.be.null;
    const lifecycleB = await getFeatureLifecycle(versionB.submissionFeatureId);
    expect(lifecycleB.record_effective_date).to.not.be.null;
    expect(lifecycleB.record_end_date).to.be.null;

    // Re-approving the already-activated upload is a no-op: no new log rows.
    const reapprovalCounts = await service.reconcileAndActivateSubmissionUpload(versionB.submissionUploadId);
    expect(reapprovalCounts).to.eql({ new: 0, unchanged: 0, superseded: 0, conflict: 0 });
    expect(await getLogRows(submissionId)).to.have.length(1);

    // An unchanged re-submission (same content hash) leaves the active feature untouched
    // and is counted by the reconciliation summary, not the log.
    const versionC = await publishVersion(submissionId, HASH_2);
    expect(versionC.counts).to.eql({ new: 0, unchanged: 1, superseded: 0, conflict: 0 });
    expect(await getLogRows(submissionId)).to.have.length(1);

    const lifecycleBAfterC = await getFeatureLifecycle(versionB.submissionFeatureId);
    expect(lifecycleBAfterC.record_end_date).to.be.null;
  });

  it('resolves a multi-hop version chain from a historical feature to the current active feature', async () => {
    const submissionId = await createTestSubmission(connection);

    const versionA = await publishVersion(submissionId, HASH_1);
    const versionB = await publishVersion(submissionId, HASH_2);
    const versionD = await publishVersion(submissionId, HASH_3);

    const logRows = await getLogRows(submissionId);
    expect(logRows).to.have.length(2);
    expect(logRows.map((row) => [row.previous_submission_feature_id, row.new_submission_feature_id])).to.eql([
      [versionA.submissionFeatureId, versionB.submissionFeatureId],
      [versionB.submissionFeatureId, versionD.submissionFeatureId]
    ]);

    // The chain walk documented on the table: follow previous -> new to the tip. The tip is
    // the latest recorded replacement, not necessarily a live row (see the table comment) —
    // the final assertions below prove it IS live in this deny-free scenario.
    const resolved = await connection.sql(SQL`
      WITH RECURSIVE chain AS (
        SELECT l.new_submission_feature_id, 1 AS depth
        FROM submission_feature_log l
        WHERE l.previous_submission_feature_id = ${versionA.submissionFeatureId}
          AND l.action = 'superseded'
        UNION ALL
        SELECT l.new_submission_feature_id, c.depth + 1
        FROM submission_feature_log l
        JOIN chain c ON l.previous_submission_feature_id = c.new_submission_feature_id
        WHERE l.action = 'superseded'
          AND c.depth < 1000
      )
      SELECT COALESCE(
        (SELECT new_submission_feature_id FROM chain ORDER BY depth DESC LIMIT 1),
        ${versionA.submissionFeatureId}
      ) AS current_submission_feature_id;
    `);
    expect(resolved.rows[0].current_submission_feature_id).to.equal(versionD.submissionFeatureId);

    // The chain tip is the live published row for the key.
    const lifecycleD = await getFeatureLifecycle(versionD.submissionFeatureId);
    expect(lifecycleD.record_effective_date).to.not.be.null;
    expect(lifecycleD.record_end_date).to.be.null;
  });

  it('rejects a second terminal transition for the same predecessor (submission_feature_log_uk1)', async () => {
    const submissionId = await createTestSubmission(connection);

    const versionA = await publishVersion(submissionId, HASH_1);
    const versionB = await publishVersion(submissionId, HASH_2);

    // versionA's feature already has its one terminal transition; a second must be rejected.
    await expectConstraintViolation(
      connection.sql(SQL`
        INSERT INTO submission_feature_log (
          submission_id,
          submission_upload_id,
          feature_type_id,
          source_id,
          action,
          previous_submission_feature_id,
          new_submission_feature_id,
          previous_content_hash,
          new_content_hash
        )
        SELECT
          ${submissionId},
          ${versionB.submissionUploadId}::uuid,
          feature_type_id,
          ${SOURCE_ID},
          'superseded'::submission_feature_log_action,
          ${versionA.submissionFeatureId},
          ${versionB.submissionFeatureId},
          ${HASH_1},
          ${HASH_2}
        FROM submission_feature
        WHERE submission_feature_id = ${versionA.submissionFeatureId};
      `),
      'unique constraint "submission_feature_log_uk1"'
    );
  });

  it('accepts a well-formed removed row and rejects a removed row that names a replacement (ck1)', async () => {
    const submissionId = await createTestSubmission(connection);

    const uploadA = await createIndexedUpload(submissionId, [
      { source_id: `${SOURCE_ID}-1`, content_hash: HASH_1 },
      { source_id: `${SOURCE_ID}-2`, content_hash: HASH_2 }
    ]);
    const [feature1, feature2] = await getFeatureIdsByUpload(uploadA);
    await service.reconcileAndActivateSubmissionUpload(uploadA);

    // The future removal workflow's shape needs no schema change: no replacement row or
    // hash; the owning upload is optional for removals (NULL here).
    await connection.sql(SQL`
      INSERT INTO submission_feature_log (
        submission_id,
        feature_type_id,
        source_id,
        action,
        previous_submission_feature_id,
        previous_content_hash
      )
      SELECT
        ${submissionId},
        feature_type_id,
        ${`${SOURCE_ID}-1`},
        'removed'::submission_feature_log_action,
        ${feature1},
        ${HASH_1}
      FROM submission_feature
      WHERE submission_feature_id = ${feature1};
    `);

    const logRows = await getLogRows(submissionId);
    expect(logRows).to.have.length(1);
    expect(logRows[0]).to.include({
      action: 'removed',
      previous_submission_feature_id: feature1,
      new_submission_feature_id: null,
      submission_upload_id: null,
      new_content_hash: null
    });

    // A removed transition must not name a replacement.
    await expectConstraintViolation(
      connection.sql(SQL`
        INSERT INTO submission_feature_log (
          submission_id,
          feature_type_id,
          source_id,
          action,
          previous_submission_feature_id,
          new_submission_feature_id
        )
        SELECT
          ${submissionId},
          feature_type_id,
          ${`${SOURCE_ID}-2`},
          'removed'::submission_feature_log_action,
          ${feature2},
          ${feature1}
        FROM submission_feature
        WHERE submission_feature_id = ${feature2};
      `),
      'check constraint "submission_feature_log_ck1"'
    );
  });
});
