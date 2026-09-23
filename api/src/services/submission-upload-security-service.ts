import { IDBConnection } from '../database/db';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';

const defaultLog = getLogger('services/submission-upload-security-service');

/**
 * Orchestrates automatic security screening for a `submission_upload`.
 *
 * Screening is an independent background workflow that runs after `submission_feature_closure`
 * has been populated. It does NOT change `submission_upload.status`; its lifecycle is recorded as
 * an event row in `submission_upload_security`.
 * Rule fetching, evaluation and assignment creation are deferred to a future screening implementation.
 *
 * @export
 * @class SubmissionUploadSecurityService
 * @extends {DBService}
 */
export class SubmissionUploadSecurityService extends DBService {
  submissionUploadSecurityRepository: SubmissionUploadSecurityRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadSecurityRepository = new SubmissionUploadSecurityRepository(connection);
  }

  /**
   * Run automatic security screening for a single `submission_upload`.
   *
   * Creates and completes the screening event in the caller's transaction.
   * Rule fetching, evaluation and assignment creation are deferred to a future screening implementation.
   *
   * @param {string} submissionUploadId UUID of the upload to screen.
   * @param {number} submissionId Submission ID (for log context only).
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

    const submissionUploadSecurityId = await this.submissionUploadSecurityRepository.insertScanEvent(
      submissionUploadId,
      jobId
    );

    await this.submissionUploadSecurityRepository.updateScanEventStatus(submissionUploadSecurityId, 'completed', {
      ruleCount: 0,
      insertedCount: 0
    });

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
   * survives a failure — so this inserts a fresh event row and immediately marks it `failed` for
   * operator visibility.
   *
   * @param {string} submissionUploadId UUID of the upload whose screening failed.
   * @param {(string | null)} jobId The pg-boss job id, if available.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityService
   */
  async recordScreeningFailure(submissionUploadId: string, jobId: string | null): Promise<void> {
    const submissionUploadSecurityId = await this.submissionUploadSecurityRepository.insertScanEvent(
      submissionUploadId,
      jobId
    );

    await this.submissionUploadSecurityRepository.updateScanEventStatus(submissionUploadSecurityId, 'failed');
  }
}
