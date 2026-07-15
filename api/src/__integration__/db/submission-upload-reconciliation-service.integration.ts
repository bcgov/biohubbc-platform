// Integration tests for durable reconciliation, promotion, and activation.
//
// Covers immutable submission_feature version history, durable per-upload reconciliation
// counts, idempotent re-approval, and atomic rejection when classification finds a conflict.
// Each test seeds its own fixture and rolls back.
//
// Run: docker compose exec api npm run test:mocha -- --no-config --extension ts \
//        'src/__integration__/db/submission-upload-reconciliation-service.integration.ts'
// Requires: database container running with seed data.

import { expect } from 'chai';
import { describe } from 'mocha';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP409 } from '../../errors/http-error';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

const FEATURE_TYPE_NAME = 'survey';
const SOURCE_ID = 'reconciliation-source-1';
const HASH_1 = 'a'.repeat(64);
const HASH_2 = 'b'.repeat(64);

describe('SubmissionUploadReconciliationService — activation (integration)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let service: SubmissionUploadReconciliationService;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionUploadReconciliationService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  async function createIndexedUpload(
    submissionId: number,
    features: Array<{ source_id: string | null; content_hash?: string | null }>
  ): Promise<string> {
    const submissionUploadId = await createTestUploadWithFeatures(
      connection,
      submissionId,
      FEATURE_TYPE_NAME,
      [],
      'indexed'
    );
    const featureType = await connection.sql(SQL`
      SELECT feature_type_id FROM feature_type WHERE name = ${FEATURE_TYPE_NAME} LIMIT 1;
    `);
    for (const feature of features) {
      const data = JSON.stringify({ source_id: feature.source_id });
      await connection.sql(SQL`
        INSERT INTO submission_upload_feature (
          submission_upload_id,
          source_id,
          feature_type_id,
          data,
          data_byte_size,
          content_hash
        ) VALUES (
          ${submissionUploadId}::uuid,
          ${feature.source_id},
          ${featureType.rows[0].feature_type_id},
          ${data}::jsonb,
          octet_length(${data}::jsonb::text),
          ${feature.content_hash ?? HASH_1}
        );
      `);
    }
    const counts = await service.reconcileSubmissionUploadFeatures(submissionUploadId);
    if (counts.conflict === 0) {
      await service.promoteSubmissionUploadFeatures(submissionUploadId);
    }
    return submissionUploadId;
  }

  async function getFeatureIdsByUpload(submissionUploadId: string): Promise<number[]> {
    const result = await connection.sql(SQL`
      SELECT submission_feature_id
      FROM submission_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY submission_feature_id;
    `);
    return result.rows.map((row) => row.submission_feature_id);
  }

  async function publishVersion(submissionId: number, contentHash: string) {
    const submissionUploadId = await createIndexedUpload(submissionId, [
      { source_id: SOURCE_ID, content_hash: contentHash }
    ]);
    const [submissionFeatureId] = await getFeatureIdsByUpload(submissionUploadId);
    const counts = await service.activateSubmissionUploadReconciliation(submissionUploadId);
    await connection.sql(SQL`
      INSERT INTO submission_upload_status (submission_upload_id, status)
      VALUES (${submissionUploadId}::uuid, 'approved');
    `);
    return { submissionUploadId, submissionFeatureId, counts };
  }

  async function getFeatureLifecycle(submissionFeatureId: number) {
    const result = await connection.sql(SQL`
      SELECT
        submission_upload_id,
        source_id,
        content_hash,
        record_effective_date,
        record_end_date
      FROM submission_feature
      WHERE submission_feature_id = ${submissionFeatureId};
    `);
    return result.rows[0];
  }

  it('preserves immutable feature versions and durable per-upload counts', async () => {
    const submissionId = await createTestSubmission(connection);

    const versionA = await publishVersion(submissionId, HASH_1);
    expect(versionA.counts).to.eql({ new: 1, unchanged: 0, superseded: 0, conflict: 0 });

    const versionB = await publishVersion(submissionId, HASH_2);
    expect(versionB.counts).to.eql({ new: 0, unchanged: 0, superseded: 1, conflict: 0 });

    const lifecycleA = await getFeatureLifecycle(versionA.submissionFeatureId);
    expect(lifecycleA).to.include({
      submission_upload_id: versionA.submissionUploadId,
      source_id: SOURCE_ID,
      content_hash: HASH_1
    });
    expect(lifecycleA.record_effective_date).to.not.be.null;
    expect(lifecycleA.record_end_date).to.not.be.null;

    const lifecycleB = await getFeatureLifecycle(versionB.submissionFeatureId);
    expect(lifecycleB).to.include({
      submission_upload_id: versionB.submissionUploadId,
      source_id: SOURCE_ID,
      content_hash: HASH_2
    });
    expect(lifecycleB.record_effective_date).to.not.be.null;
    expect(lifecycleB.record_end_date).to.be.null;

    const reapprovalCounts = await service.activateSubmissionUploadReconciliation(versionB.submissionUploadId);
    expect(reapprovalCounts).to.eql(versionB.counts);

    await service.revokeSubmissionUploadReconciliation(versionB.submissionUploadId);
    expect((await getFeatureLifecycle(versionB.submissionFeatureId)).record_end_date).to.not.be.null;
    expect((await getFeatureLifecycle(versionA.submissionFeatureId)).record_end_date).to.be.null;

    const postRevocationReapprovalCounts = await service.activateSubmissionUploadReconciliation(
      versionB.submissionUploadId
    );
    expect(postRevocationReapprovalCounts).to.eql(versionB.counts);
    expect((await getFeatureLifecycle(versionB.submissionFeatureId)).record_end_date).to.be.null;

    const summary = await connection.sql(SQL`
      SELECT sur.reconciliation AS name, sur.count
      FROM submission_upload_reconciliation sur
      WHERE sur.submission_upload_id = ${versionB.submissionUploadId}::uuid
      ORDER BY sur.reconciliation;
    `);
    expect(summary.rows).to.deep.equal([
      { name: 'new', count: 0 },
      { name: 'unchanged', count: 0 },
      { name: 'superseded', count: 1 },
      { name: 'conflict', count: 0 }
    ]);

    const staging = await connection.sql(SQL`
      SELECT COUNT(*)::integer AS count
      FROM submission_upload_feature
      WHERE submission_upload_id = ${versionB.submissionUploadId}::uuid;
    `);
    expect(staging.rows[0].count).to.equal(1);

    const versionC = await publishVersion(submissionId, HASH_2);
    expect(versionC.counts).to.eql({ new: 0, unchanged: 1, superseded: 0, conflict: 0 });
    expect((await getFeatureLifecycle(versionB.submissionFeatureId)).record_end_date).to.be.null;
    expect(await getFeatureIdsByUpload(versionC.submissionUploadId)).to.deep.equal([]);
  });

  it('rejects approval when an unchanged reconciliation is stale', async () => {
    const submissionId = await createTestSubmission(connection);
    await publishVersion(submissionId, HASH_1);
    const staleUploadId = await createIndexedUpload(submissionId, [{ source_id: SOURCE_ID, content_hash: HASH_1 }]);

    await publishVersion(submissionId, HASH_2);

    try {
      await service.activateSubmissionUploadReconciliation(staleUploadId);
      expect.fail('Expected stale reconciliation rejection');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
      expect((error as Error).message).to.include('stale');
    }
  });

  it('does not partially activate valid features when any reconciliation key conflicts', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createIndexedUpload(submissionId, [
      { source_id: `${SOURCE_ID}-valid`, content_hash: HASH_1 },
      { source_id: null, content_hash: HASH_2 }
    ]);
    const featureIds = await getFeatureIdsByUpload(uploadId);

    try {
      await service.activateSubmissionUploadReconciliation(uploadId);
      expect.fail('Expected reconciliation conflict');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
    }

    const lifecycle = await connection.sql(SQL`
      SELECT submission_feature_id, record_effective_date, record_end_date
      FROM submission_feature
      WHERE submission_feature_id = ANY(${featureIds}::integer[])
      ORDER BY submission_feature_id;
    `);
    expect(lifecycle.rows).to.have.lengthOf(0);

    const summary = await connection.sql(SQL`
      SELECT 1
      FROM submission_upload_reconciliation
      WHERE submission_upload_id = ${uploadId}::uuid;
    `);
    expect(summary.rowCount).to.equal(4);
  });
});
