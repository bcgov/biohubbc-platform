import SQL from 'sql-template-strings';
import {
  SubmissionValidationId,
  SubmissionValidationRecord,
  SubmissionValidationStatus
} from '../models/submission-validation';
import { BaseRepository } from './base-repository';

/**
 * A repository class for accessing submission validation data.
 *
 * @export
 * @class SubmissionValidationRepository
 * @extends {BaseRepository}
 */
export class SubmissionValidationRepository extends BaseRepository {
  /**
   * Create a new submission validation record keyed by submission_upload_id.
   * Each upload event gets its own validation record to track ingestion status independently.
   *
   * @param {string} submissionUploadId - The submission_upload_id (UUID).
   * @param {number} submissionId - The submission ID.
   * @param {string} jobId - The pg-boss job UUID.
   * @return {Promise<{ submission_validation_id: number }>} The created record ID.
   * @memberof SubmissionValidationRepository
   */
  async createSubmissionValidation(
    submissionUploadId: string,
    submissionId: number,
    jobId: string
  ): Promise<{ submission_validation_id: number }> {
    const sql = SQL`
      INSERT INTO submission_validation (submission_upload_id, submission_id, job_id, status)
      VALUES (${submissionUploadId}::uuid, ${submissionId}, ${jobId}::uuid, 'pending')
      RETURNING submission_validation_id;
    `;

    const response = await this.connection.sql(sql, SubmissionValidationId);

    return response.rows[0];
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
   * @memberof SubmissionValidationRepository
   */
  async updateSubmissionValidationStatus(
    jobId: string,
    status: SubmissionValidationStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const sql = SQL`
      UPDATE submission_validation
      SET
        status = ${status},
        metadata = ${JSON.stringify(metadata ?? null)}::jsonb,
        started_at = CASE WHEN ${status} = 'started' THEN now() ELSE started_at END,
        ended_at = CASE WHEN ${status} IN ('completed', 'invalid', 'failed') THEN now() ELSE ended_at END
      WHERE job_id = ${jobId}::uuid;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Get the most recent submission validation record for a submission upload.
   *
   * @param {string} submissionUploadId - The submission_upload_id (UUID).
   * @return {Promise<SubmissionValidationRecord | null>}
   * @memberof SubmissionValidationRepository
   */
  async getSubmissionValidationBySubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionValidationRecord | null> {
    const sql = SQL`
      SELECT submission_validation_id, job_id, status
      FROM submission_validation
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY create_date DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sql, SubmissionValidationRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Update the most recent submission validation status by submission_upload_id.
   *
   * Used by Dead Letter Queue handler where the original job ID is not available.
   * Scoped to the latest record so manual retries don't corrupt historical records.
   *
   * @param {string} submissionUploadId - The submission_upload_id (UUID).
   * @param {SubmissionValidationStatus} status - The new status.
   * @param {Record<string, unknown>} [metadata] - Optional metadata (e.g., error details).
   * @return {Promise<void>}
   * @memberof SubmissionValidationRepository
   */
  async updateSubmissionValidationStatusBySubmissionUploadId(
    submissionUploadId: string,
    status: SubmissionValidationStatus,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const sql = SQL`
      UPDATE submission_validation
      SET
        status = ${status},
        metadata = ${JSON.stringify(metadata ?? null)}::jsonb,
        ended_at = CASE WHEN ${status} IN ('completed', 'invalid', 'failed') THEN now() ELSE ended_at END
      WHERE submission_validation_id = (
        SELECT submission_validation_id
        FROM submission_validation
        WHERE submission_upload_id = ${submissionUploadId}::uuid
        ORDER BY create_date DESC
        LIMIT 1
      );
    `;

    await this.connection.sql(sql);
  }
}
