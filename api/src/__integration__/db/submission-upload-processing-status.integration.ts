// Run with: npm run test:db -- --grep "submission upload processing status"

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { SubmissionUploadJobStatus } from '../../models/submission-upload';
import { SubmissionUploadProcessingStatusRepository } from '../../repositories/upload/submission-upload-processing-status-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
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

  async function submissionUuid(submissionUploadId: string): Promise<string> {
    const result = await connection.sql(SQL`
      SELECT s.uuid
      FROM submission_upload su
      INNER JOIN submission s ON s.submission_id = su.submission_id
      WHERE su.submission_upload_id = ${submissionUploadId}::uuid;
    `);
    return result.rows[0].uuid;
  }

  /**
   * Active processing history as the administrative history endpoint reads it.
   */
  async function activeHistory(submissionUploadId: string) {
    return processingStatusRepository.findSubmissionUploadProcessingStatusHistory(
      await submissionUuid(submissionUploadId),
      submissionUploadId
    );
  }

  async function currentStatus(submissionUploadId: string): Promise<string> {
    const result = await connection.sql(SQL`
      SELECT status FROM submission_upload WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `);
    return result.rows[0].status;
  }

  it('types the status log with the job status enum, whose values match the model', async () => {
    const result = await connection.sql(SQL`
      SELECT
        t.typname AS column_type,
        (
          SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
          FROM pg_enum e
          INNER JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'submission_upload_job_status'
        ) AS job_statuses,
        EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_upload_status_type') AS review_enum_exists
      FROM pg_attribute a
      INNER JOIN pg_class c ON c.oid = a.attrelid
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      INNER JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'biohub'
        AND c.relname = 'submission_upload_status'
        AND a.attname = 'status';
    `);

    expect(result.rows[0].column_type).to.equal('submission_upload_job_status');
    expect(result.rows[0].job_statuses).to.eql([...SubmissionUploadJobStatus.options]);
    expect(result.rows[0].review_enum_exists).to.be.false;
  });

  it('records each transition as an active row in order and keeps submission_upload.status current', async () => {
    const submissionUploadId = await createUploadedUpload();

    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);

    const active = await activeHistory(submissionUploadId);
    expect(active.map((row) => row.status)).to.eql(['uploaded', 'ingesting', 'ingested']);
    expect(active.every((row) => row.submission_upload_id === submissionUploadId)).to.be.true;
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
    const active = await activeHistory(submissionUploadId);
    expect(active.map((row) => row.status)).to.eql(['uploaded', 'ingesting']);
    expect(await currentStatus(submissionUploadId)).to.equal('ingesting');
  });

  it('history lookup distinguishes an upload with no history from an upload outside the submission', async () => {
    const submissionId = await createTestSubmission(connection);
    const submissionUploadId = await createTestUploadWithFeatures(connection, submissionId, 'survey', [], 'uploaded');
    const otherSubmissionId = await createTestSubmission(connection);
    const otherSubmissionUploadId = await createTestUploadWithFeatures(
      connection,
      otherSubmissionId,
      'survey',
      [],
      'uploaded'
    );

    const noHistory = await activeHistory(submissionUploadId);
    expect(noHistory).to.eql([
      { submission_upload_id: submissionUploadId, submission_upload_status_id: null, status: null, create_date: null }
    ]);

    const wrongSubmission = await processingStatusRepository.findSubmissionUploadProcessingStatusHistory(
      await submissionUuid(submissionUploadId),
      otherSubmissionUploadId
    );
    expect(wrongSubmission).to.eql([]);
  });

  it('processing transitions leave the decision untouched and the publish history reports it', async () => {
    const submissionUploadId = await createUploadedUpload();
    await service.transitionSubmissionUploadToIngesting(submissionUploadId);
    await service.transitionSubmissionUploadToIngested(submissionUploadId);

    const upload = await connection.sql(SQL`
      SELECT su.ticket_id, su.decision, s.uuid
      FROM submission_upload su
      INNER JOIN submission s ON s.submission_id = su.submission_id
      WHERE su.submission_upload_id = ${submissionUploadId}::uuid;
    `);
    expect(upload.rows[0].decision).to.equal('pending');

    const ticketUploads = await new SubmissionUploadRepository(connection).findSubmissionUploadsByTicketId(
      upload.rows[0].ticket_id
    );
    const ticketUpload = ticketUploads.find((row) => row.submission_upload_id === submissionUploadId);
    expect(ticketUpload?.decision).to.equal('pending');
    expect(ticketUpload?.upload_status).to.equal('ingested');

    const history = await service.findSubmissionDecisionHistoryByUuid(upload.rows[0].uuid);
    expect(history.history.map((row) => [row.submissionUploadId, row.status])).to.eql([
      [submissionUploadId, 'submitted']
    ]);
  });
});
