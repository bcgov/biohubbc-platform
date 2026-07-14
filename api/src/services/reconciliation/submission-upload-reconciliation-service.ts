import { IDBConnection } from '../../database/db';
import {
  CreateSubmissionUploadReconciliation,
  SubmissionUploadReconciliation,
  UpdateSubmissionUploadReconciliation
} from '../../models/submission-upload-reconciliation';
import { SubmissionUploadReconciliationRepository } from '../../repositories/reconciliation/submission-upload-reconciliation-repository';
import { DBService } from '../db-service';

/**
 * Service for submission upload reconciliation count records.
 *
 * Business-specific classification and approval orchestration are intentionally
 * kept outside these core table operations.
 *
 * @export
 * @class SubmissionUploadReconciliationService
 * @extends {DBService}
 */
export class SubmissionUploadReconciliationService extends DBService {
  submissionUploadReconciliationRepository: SubmissionUploadReconciliationRepository;

  /**
   * Create a submission upload reconciliation service.
   *
   * @param {IDBConnection} connection Active database connection.
   * @memberof SubmissionUploadReconciliationService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReconciliationRepository = new SubmissionUploadReconciliationRepository(connection);
  }

  /**
   * Insert or update a reconciliation count for a submission upload and outcome.
   *
   * @param {CreateSubmissionUploadReconciliation} data Reconciliation count fields.
   * @returns {Promise<SubmissionUploadReconciliation>} The upserted count record.
   * @memberof SubmissionUploadReconciliationService
   */
  async upsertSubmissionUploadReconciliation(
    data: CreateSubmissionUploadReconciliation
  ): Promise<SubmissionUploadReconciliation> {
    return this.submissionUploadReconciliationRepository.upsertSubmissionUploadReconciliation(data);
  }

  /**
   * Get a submission upload reconciliation record by its primary key.
   *
   * @param {number} submissionUploadReconciliationId Reconciliation record identifier.
   * @returns {Promise<SubmissionUploadReconciliation>} The matching count record.
   * @memberof SubmissionUploadReconciliationService
   */
  async getSubmissionUploadReconciliation(
    submissionUploadReconciliationId: number
  ): Promise<SubmissionUploadReconciliation> {
    return this.submissionUploadReconciliationRepository.getSubmissionUploadReconciliation(
      submissionUploadReconciliationId
    );
  }

  /**
   * Get reconciliation count records for a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadReconciliation[]>} Reconciliation count records.
   * @memberof SubmissionUploadReconciliationService
   */
  async getSubmissionUploadReconciliationsForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionUploadReconciliation[]> {
    return this.submissionUploadReconciliationRepository.getSubmissionUploadReconciliationsForSubmissionUploadId(
      submissionUploadId
    );
  }

  /**
   * Update the count on a submission upload reconciliation record.
   *
   * @param {number} submissionUploadReconciliationId Reconciliation record identifier.
   * @param {UpdateSubmissionUploadReconciliation} data Updated count value.
   * @returns {Promise<SubmissionUploadReconciliation>} The updated count record.
   * @memberof SubmissionUploadReconciliationService
   */
  async updateSubmissionUploadReconciliation(
    submissionUploadReconciliationId: number,
    data: UpdateSubmissionUploadReconciliation
  ): Promise<SubmissionUploadReconciliation> {
    return this.submissionUploadReconciliationRepository.updateSubmissionUploadReconciliation(
      submissionUploadReconciliationId,
      data
    );
  }

  /**
   * Delete a submission upload reconciliation record by its primary key.
   *
   * @param {number} submissionUploadReconciliationId Reconciliation record identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadReconciliationService
   */
  async deleteSubmissionUploadReconciliation(submissionUploadReconciliationId: number): Promise<void> {
    return this.submissionUploadReconciliationRepository.deleteSubmissionUploadReconciliation(
      submissionUploadReconciliationId
    );
  }
}
