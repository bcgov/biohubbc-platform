// Run with: npm run test:db -- --grep "submission upload decision"

import chai, { expect } from 'chai';
import { randomUUID } from 'node:crypto';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP409 } from '../../errors/http-error';
import { SubmissionUploadJobStatus } from '../../models/submission-upload';
import { SubmissionValidationService } from '../../services/submission-validation-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

chai.use(sinonChai);

describe('submission upload decision (integration)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let service: SubmissionUploadService;
  let publishClosureStub: sinon.SinonStub;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionUploadService(connection);
    // pg-boss is not running under test:db; the closure job publish is asserted, not executed.
    publishClosureStub = sinon
      .stub(SubmissionUploadService.dependencies, 'publishComputeSubmissionFeatureClosureJob')
      .resolves({ status: 'published', jobId: 'stub-job-id' });
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
    sinon.restore();
  });

  /**
   * Read the decision, audit revision and soft-delete state of an upload straight from the table.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns Decision columns of the upload row.
   */
  async function readUpload(submissionUploadId: string) {
    const result = await connection.sql(SQL`
      SELECT decision, revision_count, record_end_date, create_date
      FROM submission_upload
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `);
    return result.rows[0] as {
      decision: string;
      revision_count: number;
      record_end_date: string | null;
      create_date: string;
    };
  }

  /**
   * Create an upload with no features in the given processing status, optionally with completed
   * automated validation so it can be approved.
   *
   * @param {number} submissionId Owning submission.
   * @param {SubmissionUploadJobStatus} status Processing status of the upload.
   * @param {boolean} withCompletedValidation Whether to record a completed validation run.
   * @returns {Promise<string>} Submission upload identifier.
   */
  async function createUpload(
    submissionId: number,
    status: SubmissionUploadJobStatus,
    withCompletedValidation = false
  ): Promise<string> {
    const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [], status);

    if (withCompletedValidation) {
      const validationService = new SubmissionValidationService(connection);
      const jobId = randomUUID();
      await validationService.createSubmissionValidation(submissionUploadId, submissionId, jobId);
      await validationService.updateSubmissionValidationStatus(jobId, 'completed', {});
    }

    return submissionUploadId;
  }

  /**
   * Look up the UUID of a submission.
   *
   * @param {number} submissionId Submission primary key.
   * @returns {Promise<string>} Submission UUID.
   */
  async function submissionUuid(submissionId: number): Promise<string> {
    const result = await connection.sql(SQL`SELECT uuid FROM submission WHERE submission_id = ${submissionId};`);
    return result.rows[0].uuid;
  }

  it('approval writes the decision and keys the closure job on the upload audit revision', async () => {
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createUpload(submissionId, 'indexed', true);
    const before = await readUpload(submissionUploadId);
    expect(before.decision).to.equal('pending');

    const result = await service.updateSubmissionUploadDecision(submissionUploadId, { decision: 'approved' });

    expect(result).to.eql({ submission_upload_id: submissionUploadId, decision: 'approved' });
    const after = await readUpload(submissionUploadId);
    expect(after.decision).to.equal('approved');
    expect(after.revision_count).to.be.greaterThan(before.revision_count);
    expect(publishClosureStub).to.have.been.calledOnce;
    expect(publishClosureStub.firstCall.args[1]).to.eql({ submissionUploadId });
    expect(publishClosureStub.firstCall.args[2]).to.eql({
      singletonKey: `closure-recompute-${submissionUploadId}-${after.revision_count}`
    });
  });

  it('denial and reset round-trip on the decision column without queueing a closure recompute', async () => {
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createUpload(submissionId, 'indexed');
    const initial = await readUpload(submissionUploadId);

    const denied = await service.updateSubmissionUploadDecision(submissionUploadId, { decision: 'denied' });
    const afterDenial = await readUpload(submissionUploadId);

    expect(denied).to.eql({ submission_upload_id: submissionUploadId, decision: 'denied' });
    expect(afterDenial.decision).to.equal('denied');
    expect(afterDenial.revision_count).to.be.greaterThan(initial.revision_count);

    const reset = await service.updateSubmissionUploadDecision(submissionUploadId, { decision: 'pending' });
    const afterReset = await readUpload(submissionUploadId);

    expect(reset).to.eql({ submission_upload_id: submissionUploadId, decision: 'pending' });
    expect(afterReset.decision).to.equal('pending');
    expect(afterReset.revision_count).to.be.greaterThan(afterDenial.revision_count);
    expect(publishClosureStub).not.to.have.been.called;
  });

  it('deletes only an upload whose locked decision is still pending', async () => {
    const submissionId = await createTestSubmission(connection);
    const uuid = await submissionUuid(submissionId);
    const deniedUploadId = await createUpload(submissionId, 'indexed');
    const pendingUploadId = await createUpload(submissionId, 'indexed');
    await service.updateSubmissionUploadDecision(deniedUploadId, { decision: 'denied' });

    try {
      await service.deleteSubmissionUpload(uuid, deniedUploadId);
      expect.fail('Expected HTTP409');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP409);
    }
    expect((await readUpload(deniedUploadId)).record_end_date).to.be.null;

    await service.deleteSubmissionUpload(uuid, pendingUploadId);

    const deleted = await readUpload(pendingUploadId);
    expect(deleted.record_end_date).not.to.be.null;
    expect(deleted.decision).to.equal('pending');
  });

  it('publish history reports every upload of the submission with the stable wire status', async () => {
    const submissionId = await createTestSubmission(connection);
    const uuid = await submissionUuid(submissionId);
    const approvedUploadId = await createUpload(submissionId, 'indexed', true);
    const deniedUploadId = await createUpload(submissionId, 'indexed');
    const deletedUploadId = await createUpload(submissionId, 'uploaded');

    await service.updateSubmissionUploadDecision(approvedUploadId, { decision: 'approved' });
    await service.updateSubmissionUploadDecision(deniedUploadId, { decision: 'denied' });
    await service.deleteSubmissionUpload(uuid, deletedUploadId);

    const result = await service.findSubmissionDecisionHistoryByUuid(uuid);

    // Uploads created in one transaction share now(), and the audit trigger keeps create_date immutable,
    // so newest-first ordering cannot be arranged here; the ORDER BY is covered by the repository unit test.
    expect(result.submissionId).to.equal(submissionId);
    expect(result.history.map((row) => [row.submissionUploadId, row.status])).to.have.deep.members([
      [approvedUploadId, 'approved'],
      [deniedUploadId, 'denied'],
      [deletedUploadId, 'deleted']
    ]);
    for (const row of result.history) {
      const upload = await readUpload(row.submissionUploadId);
      expect(new Date(row.createDate).getTime()).to.equal(new Date(upload.create_date).getTime());
    }
  });

  it('publish history of a submission with no uploads is empty', async () => {
    const submissionId = await createTestSubmission(connection);

    const result = await service.findSubmissionDecisionHistoryByUuid(await submissionUuid(submissionId));

    expect(result).to.eql({ submissionId, history: [] });
  });
});
