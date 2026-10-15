// Integration test for the submission upload row lock held by feature pipeline jobs.
//
// Reconcile and index jobs lock the upload row for their whole stage transaction, which can run for a long time on
// large uploads. The lock must serialize those jobs without blocking inserts of rows that reference the upload, such
// as reviews, whose foreign key checks take a `FOR KEY SHARE` lock on the same row.
//
// The lock is only observable across sessions, so fixtures are COMMITTED and torn down explicitly.

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../../models/submission-upload-review';
import { SubmissionUploadReviewService } from '../../services/upload/submission-upload-review-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { createTestUpload } from '../helpers/test-feature-property-helpers';
import { createTestSubmission } from '../helpers/test-submission-helpers';

describe('Submission upload pipeline lock (integration)', function () {
  this.timeout(20000);

  let submissionId: number;
  let submissionUploadId: string;
  let jobConnection: IDBConnection;
  let otherConnection: IDBConnection;

  before(() => initDBPool(defaultPoolConfig));

  beforeEach(async () => {
    const fixtureConnection = getAPIUserDBConnection();

    try {
      await fixtureConnection.open();
      submissionId = await createTestSubmission(fixtureConnection);
      submissionUploadId = await createTestUpload(fixtureConnection, submissionId);
      await fixtureConnection.commit();
    } finally {
      fixtureConnection.release();
    }

    jobConnection = getAPIUserDBConnection();
    otherConnection = getAPIUserDBConnection();
    await jobConnection.open();
    await otherConnection.open();
  });

  afterEach(async () => {
    await otherConnection.rollback();
    otherConnection.release();
    await jobConnection.rollback();
    jobConnection.release();

    // Committed fixtures: tear down explicitly, in FK order. The upload, ticket and team scaffolding the fixture
    // helpers create is not submission-anchored and stays behind as inert rows.
    const cleanupConnection = getAPIUserDBConnection();

    try {
      await cleanupConnection.open();
      await cleanupConnection.sql(
        SQL`DELETE FROM submission_upload_review WHERE submission_upload_id = ${submissionUploadId};`
      );
      await cleanupConnection.sql(
        SQL`DELETE FROM submission_upload_status WHERE submission_upload_id = ${submissionUploadId};`
      );
      await cleanupConnection.sql(SQL`DELETE FROM submission_upload WHERE submission_id = ${submissionId};`);
      await cleanupConnection.sql(SQL`DELETE FROM submission WHERE submission_id = ${submissionId};`);
      await cleanupConnection.commit();
    } finally {
      cleanupConnection.release();
    }
  });

  it('creates a review while a pipeline job holds the upload lock', async () => {
    await new SubmissionUploadService(jobConnection).getSubmissionUploadWithLock(submissionUploadId);

    // Fail fast instead of hanging if the review insert waits on the job's lock.
    await otherConnection.sql(SQL`SET LOCAL lock_timeout = '2s';`);
    const review = await new SubmissionUploadReviewService(otherConnection).insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Security review',
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.IN_PROGRESS,
      requested_by: null
    });

    expect(review.submission_upload_id).to.equal(submissionUploadId);
  });

  it('still makes a second pipeline job wait for the upload lock', async () => {
    await new SubmissionUploadService(jobConnection).getSubmissionUploadWithLock(submissionUploadId);

    await otherConnection.sql(SQL`SET LOCAL lock_timeout = '500ms';`);

    let lockError: ApiExecuteSQLError | undefined;
    try {
      await new SubmissionUploadService(otherConnection).getSubmissionUploadWithLock(submissionUploadId);
    } catch (error) {
      lockError = error as ApiExecuteSQLError;
    }

    expect(lockError?.errors[0])
      .to.have.property('message')
      .that.matches(/lock timeout/);
  });
});
