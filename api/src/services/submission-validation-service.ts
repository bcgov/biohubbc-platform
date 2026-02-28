import { IDBConnection } from '../database/db';
import { SubmissionUploadRef } from '../models/submission-upload';
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
   * Create a new submission validation record keyed by upload_id.
   *
   * @param {SubmissionUploadRef} upload - The upload and submission identifiers.
   * @param {string} jobId - The pg-boss job UUID.
   * @return {Promise<{ submission_validation_id: number }>} The created record ID.
   * @memberof SubmissionValidationService
   */
  async createSubmissionValidation(
    upload: SubmissionUploadRef,
    jobId: string
  ): Promise<{ submission_validation_id: number }> {
    return this.submissionValidationRepository.createSubmissionValidation(upload, jobId);
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
   * Get the most recent submission validation record for an upload.
   *
   * @param {string} uploadId - The upload ID (UUID).
   * @return {Promise<SubmissionValidationRecord | null>}
   * @memberof SubmissionValidationService
   */
  async getSubmissionValidationByUploadId(uploadId: string): Promise<SubmissionValidationRecord | null> {
    return this.submissionValidationRepository.getSubmissionValidationByUploadId(uploadId);
  }

  /**
   * Update submission validation status by upload ID.
   *
   * Used by Dead Letter Queue handler where the original job ID is not available.
   *
   * @param {string} uploadId - The upload ID (UUID).
   * @param {SubmissionValidationStatus} status - The new status.
   * @param {Record<string, unknown>} [metadata] - Optional metadata (e.g., error details).
   * @return {Promise<void>}
   * @memberof SubmissionValidationService
   */
  async updateSubmissionValidationStatusByUploadId(
    uploadId: string,
    status: SubmissionValidationStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return this.submissionValidationRepository.updateSubmissionValidationStatusByUploadId(uploadId, status, metadata);
  }
}
