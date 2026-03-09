import { IDBConnection } from '../database/db';
import { SubmissionValidationRecord, SubmissionValidationStatus } from '../models/submission-validation';
import { SubmissionValidationRepository } from '../repositories/submission-validation-repository';
import { DBService } from './db-service';

/**
 * Service for submission validation tracking operations.
 *
 * @export
 * @class SubmissionValidationService
 * @extends {DBService}
 */
export class SubmissionValidationService extends DBService {
  submissionValidationRepository: SubmissionValidationRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionValidationRepository = new SubmissionValidationRepository(connection);
  }

  /**
   * Create a new submission validation record keyed by submission_upload_id.
   * Each upload event gets its own validation record to track ingestion status independently.
   *
   * @param {string} submissionUploadId - The submission_upload_id (UUID).
   * @param {number} submissionId - The submission ID.
   * @param {string} jobId - The pg-boss job UUID.
   * @return {Promise<{ submission_validation_id: number }>} The created record ID.
   * @memberof SubmissionValidationService
   */
  async createSubmissionValidation(
    submissionUploadId: string,
    submissionId: number,
    jobId: string
  ): Promise<{ submission_validation_id: number }> {
    return this.submissionValidationRepository.createSubmissionValidation(submissionUploadId, submissionId, jobId);
  }

  /**
   * Update submission validation status and metadata.
   *
   * Automatically sets started_at when status changes to 'started',
   * and ended_at when status changes to 'completed', 'invalid', or 'failed'.
   *
   * @param {string} jobId - The pg-boss job UUID.
   * @param {SubmissionValidationStatus} status - The new status.
   * @param {Record<string, unknown>} [metadata] - Optional metadata (e.g., error details).
   * @return {Promise<void>}
   * @memberof SubmissionValidationService
   */
  async updateSubmissionValidationStatus(
    jobId: string,
    status: SubmissionValidationStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return this.submissionValidationRepository.updateSubmissionValidationStatus(jobId, status, metadata);
  }

  /**
   * Get the most recent submission validation record for a submission upload.
   *
   * @param {string} submissionUploadId - The submission_upload_id (UUID).
   * @return {Promise<SubmissionValidationRecord | null>}
   * @memberof SubmissionValidationService
   */
  async getSubmissionValidationBySubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionValidationRecord | null> {
    return this.submissionValidationRepository.getSubmissionValidationBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Update submission validation status by submission_upload_id.
   *
   * Used by Dead Letter Queue handler where the original job ID is not available.
   * Scoped to the latest record so manual retries don't corrupt historical records.
   *
   * @param {string} submissionUploadId - The submission_upload_id (UUID).
   * @param {SubmissionValidationStatus} status - The new status.
   * @param {Record<string, unknown>} [metadata] - Optional metadata (e.g., error details).
   * @return {Promise<void>}
   * @memberof SubmissionValidationService
   */
  async updateSubmissionValidationStatusBySubmissionUploadId(
    submissionUploadId: string,
    status: SubmissionValidationStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return this.submissionValidationRepository.updateSubmissionValidationStatusBySubmissionUploadId(
      submissionUploadId,
      status,
      metadata
    );
  }
}
