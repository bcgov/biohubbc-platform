import { IDBConnection } from '../database/db';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../models/submission-upload-review';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';
import { SubmissionUploadReviewService } from './upload/submission-upload-review-service';

const defaultLog = getLogger('services/submission-upload-security-service');

/**
 * Orchestrates automatic security screening for a `submission_upload`.
 *
 * Screening is an independent background workflow that runs after `submission_feature_closure`
 * has been populated. It does NOT change `submission_upload.status`; its lifecycle is recorded as
 * an event row in `submission_upload_security`.
 * Each run creates a security review and a linked event,
 * and completes both records in the caller's transaction.
 *
 * @export
 * @class SubmissionUploadSecurityService
 * @extends {DBService}
 */
export class SubmissionUploadSecurityService extends DBService {
  submissionUploadSecurityRepository: SubmissionUploadSecurityRepository;
  submissionUploadReviewService: SubmissionUploadReviewService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadSecurityRepository = new SubmissionUploadSecurityRepository(connection);
    this.submissionUploadReviewService = new SubmissionUploadReviewService(connection);
  }

  /**
   * Run automatic security screening for a single `submission_upload`.
   *
   * Creates and completes a security review and linked screening event in the caller's transaction.
   * Rule fetching, evaluation and assignment creation are deferred to a future screening implementation.
   *
   * @param {string} submissionUploadId UUID of the upload to screen.
   * @param {number} submissionId Submission ID that owns the upload.
   * @param {(string | null)} jobId The pg-boss job id (recorded on the scan event for resync).
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityService
   */
  async screenSubmissionUpload(submissionUploadId: string, submissionId: number, jobId: string | null): Promise<void> {
    defaultLog.debug({
      label: 'screenSubmissionUpload',
      message: 'Starting automatic security screening',
      submissionUploadId,
      submissionId
    });

    const review = await this.submissionUploadReviewService.insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Automatic security screening',
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.PENDING,
      requested_by: this.connection.systemUserId()
    });
    const event = await this.submissionUploadSecurityRepository.insertSubmissionUploadSecurity(
      submissionUploadId,
      jobId,
      review.submission_upload_review_id
    );

    await this.submissionUploadReviewService.updateSubmissionUploadReview(
      submissionId,
      submissionUploadId,
      review.submission_upload_review_id,
      { status: SubmissionUploadReviewStatus.COMPLETED }
    );
    await this.submissionUploadSecurityRepository.updateSubmissionUploadSecurityStatus(
      event.submission_upload_security_id,
      'completed',
      {
        ruleCount: 0,
        insertedCount: 0
      }
    );

    defaultLog.info({
      label: 'screenSubmissionUpload',
      message: 'Automatic security screening complete',
      submissionUploadId,
      submissionId,
      insertedCount: 0
    });
  }

  /**
   * Record a permanently-failed screening attempt as a `failed` scan event row.
   *
   * Called by the dead-letter handler after pg-boss has exhausted retries. Because each screening
   * attempt runs in a single transaction that rolls back on error, no partial `started` row
   * survives a failure — so this creates a blocked review and a fresh event, then marks the event `failed` for
   * operator visibility.
   *
   * @param {string} submissionUploadId UUID of the upload whose screening failed.
   * @param {number} submissionId Submission ID that owns the upload.
   * @param {(string | null)} jobId The pg-boss job id, if available.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityService
   */
  async recordSubmissionUploadSecurityFailure(
    submissionUploadId: string,
    submissionId: number,
    jobId: string | null
  ): Promise<void> {
    const review = await this.submissionUploadReviewService.insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Automatic security screening',
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.BLOCKED,
      requested_by: this.connection.systemUserId()
    });
    const event = await this.submissionUploadSecurityRepository.insertSubmissionUploadSecurity(
      submissionUploadId,
      jobId,
      review.submission_upload_review_id
    );

    await this.submissionUploadSecurityRepository.updateSubmissionUploadSecurityStatus(
      event.submission_upload_security_id,
      'failed'
    );
  }
}
