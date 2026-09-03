// Run with: npm run test:db -- --grep "submission upload processing status"

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionUploadProcessingStatusRepository } from '../../repositories/upload/submission-upload-processing-status-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { createTestSubmission, createTestUploadWithFeatures } from '../helpers/test-submission-helpers';

describe('submission upload processing status (integration)', function () {
  this.timeout(30000);

  let connection: IDBConnection;
  let service: SubmissionUploadService;
  let processingStatusRepository: SubmissionUploadProcessingStatusRepository;

  before(() => initDBPool(defaultPoolConfig));
  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    service = new SubmissionUploadService(connection);
    processingStatusRepository = new SubmissionUploadProcessingStatusRepository(connection);
  });
  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Create an upload in the `uploaded` status with its initial history row, as the ingestion
   * service does when a submission upload is inserted.
   */
  async function createUploadedUpload(): Promise<string> {
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [], 'uploaded');
    await processingStatusRepository.insertSubmissionUploadProcessingStatus(submissionUploadId, 'uploaded');
    return submissionUploadId;
  }

  async function allStatusRows(submissionUploadId: string) {
    const result = await connection.sql(SQL`
      SELECT status, record_end_date
      FROM submission_upload_status
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY create_date ASC, submission_upload_status_id ASC;
    `);
    return result.rows as { status: string; record_end_date: Date | null }[];
  }

  async function currentStatus(submissionUploadId: string): Promise<string> {
    const result = await connection.sql(SQL`
      SELECT status FROM submission_upload WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `);
    return result.rows[0].status;
  }

  it('records each transition as an active row in order and keeps submission_upload.status current', async () => {
    const submissionUploadId = await createUploadedUpload();

    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);

    const active = await processingStatusRepository.findActiveSubmissionUploadProcessingStatuses(submissionUploadId);
    expect(active.map((row) => row.status)).to.eql(['uploaded', 'ingesting', 'ingested']);
    expect(active.every((row) => row.record_end_date === null)).to.be.true;
    expect(await currentStatus(submissionUploadId)).to.equal('ingested');
  });

  it('writes nothing when the requested status is already current', async () => {
    const submissionUploadId = await createUploadedUpload();
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);

    await service.transitionSubmissionUploadToIngesting(submissionUploadId);

    const rows = await allStatusRows(submissionUploadId);
    expect(rows.map((row) => row.status)).to.eql(['uploaded', 'ingesting']);
    expect(await currentStatus(submissionUploadId)).to.equal('ingesting');
  });

  it('restarting from an earlier stage soft-ends that stage, later stages and the failure outcome', async () => {
    const submissionUploadId = await createUploadedUpload();
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);
    await service.transitionSubmissionUploadToFailed(submissionUploadId);

    await service.transitionSubmissionUploadStatus(submissionUploadId, 'ingesting', ['failed']);

    const rows = await allStatusRows(submissionUploadId);
    expect(rows.map((row) => [row.status, row.record_end_date === null])).to.eql([
      ['uploaded', true],
      ['ingesting', false],
      ['ingested', false],
      ['failed', false],
      ['ingesting', true]
    ]);
    const active = await processingStatusRepository.findActiveSubmissionUploadProcessingStatuses(submissionUploadId);
    expect(active.map((row) => row.status)).to.eql(['uploaded', 'ingesting']);
    expect(await currentStatus(submissionUploadId)).to.equal('ingesting');
  });

  it('review decision readers ignore processing rows sharing the table', async () => {
    const submissionUploadId = await createUploadedUpload();
    const reviewStatusRepository = new SubmissionUploadReviewStatusRepository(connection);
    await reviewStatusRepository.insertSubmissionUploadReviewStatus({
      submission_upload_id: submissionUploadId,
      status: 'submitted'
    });
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);

    const reviewStatus = await reviewStatusRepository.getSubmissionUploadReviewStatus(submissionUploadId);
    expect(reviewStatus.status).to.equal('submitted');

    const upload = await connection.sql(SQL`
      SELECT su.ticket_id, s.uuid
      FROM submission_upload su
      INNER JOIN submission s ON s.submission_id = su.submission_id
      WHERE su.submission_upload_id = ${submissionUploadId}::uuid;
    `);
    const ticketUploads = await new SubmissionUploadRepository(connection).findSubmissionUploadsByTicketId(
      upload.rows[0].ticket_id
    );
    const ticketUpload = ticketUploads.find((row) => row.submission_upload_id === submissionUploadId);
    expect(ticketUpload?.review_status).to.equal('submitted');
    expect(ticketUpload?.upload_status).to.equal('ingested');

    const history = await reviewStatusRepository.getStatusHistoryBySubmissionUuid(upload.rows[0].uuid);
    expect(history.map((row) => row.status)).to.eql(['submitted']);
  });
});
