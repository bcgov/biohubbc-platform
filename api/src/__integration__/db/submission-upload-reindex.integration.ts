// Integration tests for SubmissionUploadService.reindexSubmissionUpload: the status, history and blueprint writes a
// re-index makes, and the guards that keep it to unapproved, current uploads that reached reconciliation. Queueing
// the index job is stubbed; the job itself is covered by the indexing tests.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.

import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP400, HTTP409 } from '../../errors/http-error';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

chai.use(sinonChai);

describe('Submission upload re-index (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let service: SubmissionUploadService;
  let publishStub: sinon.SinonStub;
  let submissionId: number;
  let submissionUploadId: string;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionUploadService(connection);
    publishStub = sinon
      .stub(SubmissionUploadService.dependencies, 'publishIndexSubmissionFeaturesJob')
      .resolves({ status: 'published', jobId: 'job-1' });
    submissionId = await createTestSubmission(connection);
    submissionUploadId = await createTestUpload(connection, submissionId);
  });

  afterEach(async () => {
    sinon.restore();
    await connection.rollback();
    connection.release();
  });

  /** Move the upload through ingestion, reconciliation and indexing, as the pipeline jobs do. */
  async function indexUpload(): Promise<void> {
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);
    await service.transitionSubmissionUploadToReconciled(submissionUploadId);
    await service.transitionSubmissionUploadToIndexing(submissionUploadId);
    await service.transitionSubmissionUploadToIndexed(submissionUploadId);
  }

  /** Create a blueprint that is available (effective, not ended) or retired, at the next unused version number. */
  async function createBlueprint(isRetired: boolean): Promise<number> {
    const result = await connection.sql(SQL`
      INSERT INTO blueprint (name, version_number, record_effective_date, record_end_date, create_user)
      VALUES (
        ${`Re-index blueprint ${Date.now()} ${Math.random()}`},
        (SELECT COALESCE(max(version_number), 0) + 1 FROM blueprint),
        now() - interval '2 days',
        CASE WHEN ${isRetired} THEN now() - interval '1 day' END,
        ${connection.systemUserId()}
      )
      RETURNING blueprint_id;
    `);
    return result.rows[0].blueprint_id;
  }

  /** The upload's current status and blueprint. */
  async function getUpload(): Promise<{ status: string; blueprint_id: number }> {
    const result = await connection.sql(SQL`
      SELECT status, blueprint_id FROM submission_upload WHERE submission_upload_id = ${submissionUploadId};
    `);
    return result.rows[0];
  }

  /** The upload's active processing status history, earliest first. */
  async function getActiveHistory(): Promise<string[]> {
    const rows = await service.findSubmissionUploadProcessingStatusHistory(submissionId, submissionUploadId);
    return rows.map((row) => row.status);
  }

  /** Assert that a re-index is rejected with the given error and leaves the upload unchanged. */
  async function expectRejected(blueprintId: number, errorClass: typeof HTTP400 | typeof HTTP409): Promise<void> {
    const before = await getUpload();

    try {
      await service.reindexSubmissionUpload({ submissionId, submissionUploadId }, blueprintId);
      expect.fail(`Expected ${errorClass.name} not thrown`);
    } catch (error) {
      expect(error).to.be.instanceOf(errorClass);
    }

    expect(await getUpload()).to.eql(before);
    expect(publishStub).not.to.have.been.called;
  }

  it('returns an indexed upload to reconciled, supersedes its indexing history and queues indexing', async () => {
    await indexUpload();
    const { blueprint_id: blueprintId } = await getUpload();

    await service.reindexSubmissionUpload({ submissionId, submissionUploadId }, blueprintId);

    expect(await getUpload()).to.eql({ status: 'reconciled', blueprint_id: blueprintId });
    expect(await getActiveHistory()).to.eql(['ingesting', 'ingested', 'reconciled']);
    expect(publishStub).to.have.been.calledOnceWith(connection, { submissionUploadId });

    const upload = await service.getAdminSubmissionUpload({ submissionId, submissionUploadId });
    expect(upload).to.include({ submission_upload_id: submissionUploadId, status: 'reconciled', decision: 'pending' });
  });

  it('keeps the upload blueprint after it is retired', async () => {
    const retiredBlueprintId = await createBlueprint(true);
    await connection.sql(
      SQL`UPDATE submission_upload SET blueprint_id = ${retiredBlueprintId} WHERE submission_upload_id = ${submissionUploadId};`
    );
    await indexUpload();

    await service.reindexSubmissionUpload({ submissionId, submissionUploadId }, retiredBlueprintId);

    expect(await getUpload()).to.eql({ status: 'reconciled', blueprint_id: retiredBlueprintId });
  });

  it('switches the upload to another available blueprint', async () => {
    const availableBlueprintId = await createBlueprint(false);
    await indexUpload();

    await service.reindexSubmissionUpload({ submissionId, submissionUploadId }, availableBlueprintId);

    expect(await getUpload()).to.eql({ status: 'reconciled', blueprint_id: availableBlueprintId });
  });

  it('rejects a retired blueprint the upload does not already use', async () => {
    const retiredBlueprintId = await createBlueprint(true);
    await indexUpload();

    await expectRejected(retiredBlueprintId, HTTP400);
  });

  it('re-indexes an upload that failed after reconciliation', async () => {
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);
    await service.transitionSubmissionUploadToReconciled(submissionUploadId);
    await service.transitionSubmissionUploadToFailed(submissionUploadId);
    const { blueprint_id: blueprintId } = await getUpload();

    await service.reindexSubmissionUpload({ submissionId, submissionUploadId }, blueprintId);

    expect(await getUpload()).to.eql({ status: 'reconciled', blueprint_id: blueprintId });
    expect(await getActiveHistory()).to.eql(['ingesting', 'ingested', 'reconciled']);
  });

  it('rejects an upload that failed before reconciliation', async () => {
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToFailed(submissionUploadId);
    const { blueprint_id: blueprintId } = await getUpload();

    await expectRejected(blueprintId, HTTP409);
  });

  it('rejects an upload that is still processing', async () => {
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);
    await service.transitionSubmissionUploadToReconciled(submissionUploadId);
    const { blueprint_id: blueprintId } = await getUpload();

    await expectRejected(blueprintId, HTTP409);
  });

  it('rejects an upload with a decision', async () => {
    await indexUpload();
    await connection.sql(
      SQL`UPDATE submission_upload SET decision = 'denied' WHERE submission_upload_id = ${submissionUploadId};`
    );
    const { blueprint_id: blueprintId } = await getUpload();

    await expectRejected(blueprintId, HTTP409);
  });

  it('rejects an upload of another submission', async () => {
    await indexUpload();
    const otherSubmissionId = await createTestSubmission(connection);
    const { blueprint_id: blueprintId } = await getUpload();

    try {
      await service.reindexSubmissionUpload({ submissionId: otherSubmissionId, submissionUploadId }, blueprintId);
      expect.fail('Expected not found error not thrown');
    } catch (error) {
      expect((error as Error).message).to.match(/not found/i);
    }

    expect(await getUpload()).to.eql({ status: 'indexed', blueprint_id: blueprintId });
    expect(publishStub).not.to.have.been.called;
  });
});
