import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { SubmissionUploadReconciliationCounts } from '../../models/reconciliation';
import {
  CreateSubmissionUploadReconciliation,
  SubmissionUploadReconciliation,
  UpdateSubmissionUploadReconciliation
} from '../../models/submission-upload-reconciliation';
import { BaseRepository } from '../base-repository';

/**
 * Repository for submission upload reconciliation count records.
 *
 * @export
 * @class SubmissionUploadReconciliationRepository
 * @extends {BaseRepository}
 */
export class SubmissionUploadReconciliationRepository extends BaseRepository {
  /**
   * Read the complete reconciliation summary in one statement.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadReconciliationCounts>} Reconciliation summary row.
   */
  async getSubmissionUploadReconciliationCounts(
    submissionUploadId: string
  ): Promise<SubmissionUploadReconciliationCounts> {
    const response = await this.connection.sql(
      SQL`
        SELECT
          CASE
            WHEN COUNT(summary.submission_upload_reconciliation_id) = 0 THEN NULL
            ELSE jsonb_build_object(
              'new', COALESCE(SUM(summary.count) FILTER (WHERE summary.reconciliation = 'new'), 0),
              'unchanged', COALESCE(SUM(summary.count) FILTER (WHERE summary.reconciliation = 'unchanged'), 0),
              'superseded', COALESCE(SUM(summary.count) FILTER (WHERE summary.reconciliation = 'superseded'), 0),
              'conflict', COALESCE(SUM(summary.count) FILTER (WHERE summary.reconciliation = 'conflict'), 0)
            )
          END AS reconciliation
        FROM submission_upload_reconciliation summary
        WHERE summary.submission_upload_id = ${submissionUploadId}::uuid;
      `,
      SubmissionUploadReconciliationCounts
    );

    return response.rows[0];
  }

  /**
   * Insert or update a reconciliation count for a submission upload and reconciliation.
   *
   * @param {CreateSubmissionUploadReconciliation} data Reconciliation count fields.
   * @returns {Promise<SubmissionUploadReconciliation>} The inserted count record.
   * @memberof SubmissionUploadReconciliationRepository
   */
  async upsertSubmissionUploadReconciliation(
    data: CreateSubmissionUploadReconciliation
  ): Promise<SubmissionUploadReconciliation> {
    const sql = SQL`
      INSERT INTO submission_upload_reconciliation (
        submission_upload_id,
        reconciliation,
        count
      ) VALUES (
        ${data.submission_upload_id}::uuid,
        ${data.reconciliation}::submission_feature_reconciliation_type,
        ${data.count}
      )
      ON CONFLICT (submission_upload_id, reconciliation)
      DO UPDATE SET count = EXCLUDED.count
      RETURNING
        submission_upload_reconciliation_id,
        submission_upload_id,
        reconciliation,
        count;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadReconciliation);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to upsert submission upload reconciliation', [
        'SubmissionUploadReconciliationRepository->upsertSubmissionUploadReconciliation',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission upload reconciliation record by its primary key.
   *
   * @param {number} submissionUploadReconciliationId Reconciliation record identifier.
   * @returns {Promise<SubmissionUploadReconciliation>} The matching count record.
   * @memberof SubmissionUploadReconciliationRepository
   */
  async getSubmissionUploadReconciliation(
    submissionUploadReconciliationId: number
  ): Promise<SubmissionUploadReconciliation> {
    const sql = SQL`
      SELECT
        submission_upload_reconciliation_id,
        submission_upload_id,
        reconciliation,
        count
      FROM submission_upload_reconciliation
      WHERE submission_upload_reconciliation_id = ${submissionUploadReconciliationId};
    `;

    const response = await this.connection.sql(sql, SubmissionUploadReconciliation);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload reconciliation not found', [
        'SubmissionUploadReconciliationRepository->getSubmissionUploadReconciliation',
        { submissionUploadReconciliationId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadReconciliationRepository->getSubmissionUploadReconciliation',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get reconciliation count records for a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadReconciliation[]>} Reconciliation count records.
   * @memberof SubmissionUploadReconciliationRepository
   */
  async getSubmissionUploadReconciliationsForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionUploadReconciliation[]> {
    const sql = SQL`
      SELECT
        submission_upload_reconciliation_id,
        submission_upload_id,
        reconciliation,
        count
      FROM submission_upload_reconciliation
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY reconciliation;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadReconciliation);

    return response.rows;
  }

  /**
   * Update the count on a submission upload reconciliation record.
   *
   * @param {number} submissionUploadReconciliationId Reconciliation record identifier.
   * @param {UpdateSubmissionUploadReconciliation} data Updated count value.
   * @returns {Promise<SubmissionUploadReconciliation>} The updated count record.
   * @memberof SubmissionUploadReconciliationRepository
   */
  async updateSubmissionUploadReconciliation(
    submissionUploadReconciliationId: number,
    data: UpdateSubmissionUploadReconciliation
  ): Promise<SubmissionUploadReconciliation> {
    const sql = SQL`
      UPDATE submission_upload_reconciliation
      SET count = ${data.count}
      WHERE submission_upload_reconciliation_id = ${submissionUploadReconciliationId}
      RETURNING
        submission_upload_reconciliation_id,
        submission_upload_id,
        reconciliation,
        count;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadReconciliation);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload reconciliation not found', [
        'SubmissionUploadReconciliationRepository->updateSubmissionUploadReconciliation',
        { submissionUploadReconciliationId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadReconciliationRepository->updateSubmissionUploadReconciliation',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete a submission upload reconciliation record by its primary key.
   *
   * @param {number} submissionUploadReconciliationId Reconciliation record identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadReconciliationRepository
   */
  async deleteSubmissionUploadReconciliation(submissionUploadReconciliationId: number): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_upload_reconciliation
      WHERE submission_upload_reconciliation_id = ${submissionUploadReconciliationId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload reconciliation not found', [
        'SubmissionUploadReconciliationRepository->deleteSubmissionUploadReconciliation',
        { submissionUploadReconciliationId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadReconciliationRepository->deleteSubmissionUploadReconciliation',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }
  }
}
