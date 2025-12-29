import { IDBConnection } from '../database/db';
import {
  SubmissionValidationRepository,
  SubmissionValidationStatus
} from '../repositories/submission-validation-repository';
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
   * Create a new submission validation record.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} jobId - The pg-boss job UUID.
   * @return {Promise<{ submission_validation_id: number }>} The created record ID.
   * @memberof SubmissionValidationService
   */
  async createSubmissionValidation(submissionId: number, jobId: string): Promise<{ submission_validation_id: number }> {
    return this.submissionValidationRepository.createSubmissionValidation(submissionId, jobId);
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
}
