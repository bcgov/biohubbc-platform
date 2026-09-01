// Run with: npm run test:db -- --grep "single-table reconciliation"

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP409 } from '../../errors/http-error';
import { FeatureIngestionRepository } from '../../repositories/ingestion/feature-ingestion-repository';
import { SubmissionUploadReconciliationService } from '../../services/reconciliation/submission-upload-reconciliation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

const HASH_X = 'a'.repeat(64);
const HASH_Y = 'b'.repeat(64);

describe('single-table reconciliation (integration)', function () {
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

  async function createUpload(submissionId: number, hash: string, sourceId = 'A') {
    return createTestUploadWithFeatures(
      connection,
      submissionId,
      'survey',
      [{ source_id: sourceId, content_hash: hash, data: { id: sourceId, type: 'survey', properties: {} } }],
      'indexed'
    );
  }

  async function featureForUpload(submissionUploadId: string) {
    const result = await connection.sql(SQL`
      SELECT
        submission_feature_id,
        reconciliation,
        content_hash,
        successor_submission_feature_id,
        record_effective_date,
        record_end_date
      FROM submission_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `);
    return result.rows[0];
  }

  it('creates a distinct unmodified feature and preserves a direct successor chain', async () => {
    const submissionId = await createTestSubmission(connection);

    const uploadA = await createUpload(submissionId, HASH_X);
    await service.reconcileSubmissionFeatures(uploadA);
    await service.activateSubmissionUploadReconciliation(uploadA);

    const uploadB = await createUpload(submissionId, HASH_X);
    await service.reconcileSubmissionFeatures(uploadB);
    await service.activateSubmissionUploadReconciliation(uploadB);

    const uploadC = await createUpload(submissionId, HASH_Y);
    await service.reconcileSubmissionFeatures(uploadC);
    await service.activateSubmissionUploadReconciliation(uploadC);

    const [featureA, featureB, featureC] = await Promise.all([
      featureForUpload(uploadA),
      featureForUpload(uploadB),
      featureForUpload(uploadC)
    ]);

    expect(featureA.reconciliation).to.equal('new');
    expect(featureA.successor_submission_feature_id).to.equal(featureB.submission_feature_id);
    expect(featureA.record_end_date).to.not.be.null;
    expect(featureB.reconciliation).to.equal('unmodified');
    expect(featureB.successor_submission_feature_id).to.equal(featureC.submission_feature_id);
    expect(featureB.record_end_date).to.not.be.null;
    expect(featureC.reconciliation).to.equal('modified');
    expect(featureC.successor_submission_feature_id).to.be.null;
    expect(featureC.record_effective_date).to.not.be.null;
    expect(featureC.record_end_date).to.be.null;

    const current = await connection.sql(SQL`
      SELECT submission_feature_id
      FROM submission_feature
      WHERE submission_id = ${submissionId}
        AND source_id = 'A'
        AND record_effective_date <= now()
        AND (record_end_date IS NULL OR now() < record_end_date)
        AND successor_submission_feature_id IS NULL;
    `);
    expect(current.rows).to.deep.equal([{ submission_feature_id: featureC.submission_feature_id }]);
  });

  it('publishes the reconciliation stored during intake without reclassifying at approval', async () => {
    const submissionId = await createTestSubmission(connection);
    const baselineUpload = await createUpload(submissionId, HASH_X);
    await service.reconcileSubmissionFeatures(baselineUpload);
    await service.activateSubmissionUploadReconciliation(baselineUpload);

    const pendingUpload = await createUpload(submissionId, HASH_X);
    await service.reconcileSubmissionFeatures(pendingUpload);

    const approvalCounts = await service.activateSubmissionUploadReconciliation(pendingUpload);
    expect(approvalCounts).to.eql({ new: 0, modified: 0, unmodified: 1 });
    expect((await featureForUpload(pendingUpload)).reconciliation).to.equal('unmodified');
  });

  it('rejects duplicate source identity before reconciliation', async () => {
    const submissionId = await createTestSubmission(connection);
    const uploadId = await createTestUploadWithFeatures(
      connection,
      submissionId,
      'survey',
      [
        { source_id: 'duplicate', content_hash: HASH_X },
        { source_id: 'duplicate', content_hash: HASH_Y }
      ],
      'indexed'
    );

    expect(await service.validateSubmissionFeatureSourceIdentity(uploadId)).to.equal(2);
    const rows = await connection.sql(SQL`
      SELECT reconciliation
      FROM submission_feature
      WHERE submission_upload_id = ${uploadId}::uuid;
    `);
    expect(rows.rows).to.deep.equal([{ reconciliation: null }, { reconciliation: null }]);
  });

  it('replaces never-activated ingestion rows without deleting activated history', async () => {
    const submissionId = await createTestSubmission(connection);
    const pendingUpload = await createUpload(submissionId, HASH_X, 'pending');
    const activatedUpload = await createUpload(submissionId, HASH_Y, 'activated');
    await service.reconcileSubmissionFeatures(activatedUpload);
    await service.activateSubmissionUploadReconciliation(activatedUpload);

    const repository = new FeatureIngestionRepository(connection);
    await repository.deleteSubmissionFeaturesBySubmissionUploadId(pendingUpload);
    await repository.deleteSubmissionFeaturesBySubmissionUploadId(activatedUpload);

    const result = await connection.sql(SQL`
      SELECT submission_upload_id, record_effective_date
      FROM submission_feature
      WHERE submission_upload_id IN (${pendingUpload}::uuid, ${activatedUpload}::uuid)
      ORDER BY submission_upload_id;
    `);

    expect(result.rows).to.have.length(1);
    expect(result.rows[0].submission_upload_id).to.equal(activatedUpload);
    expect(result.rows[0].record_effective_date).to.not.be.null;
  });

  it('blocks mutation after activation while allowing pending uploads to be removed', async () => {
    const submissionId = await createTestSubmission(connection);
    const approvedUpload = await createUpload(submissionId, HASH_X);
    await service.reconcileSubmissionFeatures(approvedUpload);
    await service.activateSubmissionUploadReconciliation(approvedUpload);

    // Superseding every feature from the first upload must not restore its mutability.
    const successorUpload = await createUpload(submissionId, HASH_Y);
    await service.reconcileSubmissionFeatures(successorUpload);
    await service.activateSubmissionUploadReconciliation(successorUpload);

    const pendingUpload = await createUpload(submissionId, HASH_Y, 'B');
    const submissionUploadService = new SubmissionUploadService(connection);

    try {
      await submissionUploadService.softDeleteSubmissionUpload(approvedUpload);
      expect.fail('Expected activated upload mutation to be rejected');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
      expect((error as HTTP409).message).to.include('immutable');
    }

    await submissionUploadService.softDeleteSubmissionUpload(pendingUpload);

    const result = await connection.sql(SQL`
      SELECT submission_upload_id, record_end_date
      FROM submission_upload
      WHERE submission_upload_id IN (${approvedUpload}::uuid, ${pendingUpload}::uuid)
      ORDER BY submission_upload_id;
    `);
    const rows = new Map(result.rows.map((row) => [row.submission_upload_id, row.record_end_date]));
    expect(rows.get(approvedUpload)).to.be.null;
    expect(rows.get(pendingUpload)).to.not.be.null;
  });
});
