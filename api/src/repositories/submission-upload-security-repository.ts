import SQL from 'sql-template-strings';
import { SubmissionUploadSecurityId, SubmissionUploadSecurityStatus } from '../models/submission-upload-security';
import { BaseRepository } from './base-repository';

/**
 * Repository for the submission_upload_security table.
 *
 * One row represents one automatic security screening *event* for a submission upload. The
 * automatic screening job owns this table's lifecycle (started → completed/failed) without
 * touching submission_upload.status, since screening is an independent background workflow.
 * The table is append-only: a re-screen inserts a new event row.
 *
 * @export
 * @class SubmissionUploadSecurityRepository
 * @extends {BaseRepository}
 */
export class SubmissionUploadSecurityRepository extends BaseRepository {
  /**
   * Insert a new screening event row in the `started` state.
   *
   * @param {string} submissionUploadId The upload being screened.
   * @param {(string | null)} jobId The pg-boss job id (for resync), if available.
   * @returns {Promise<number>} The new submission_upload_security_id.
   * @memberof SubmissionUploadSecurityRepository
   */
  async insertScanEvent(submissionUploadId: string, jobId: string | null): Promise<number> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload_security (submission_upload_id, job_id, status, started_at)
      VALUES (${submissionUploadId}::uuid, ${jobId}::uuid, 'started'::submission_upload_security_status, now())
      RETURNING submission_upload_security_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadSecurityId);

    return response.rows[0].submission_upload_security_id;
  }

  /**
   * Move a screening event row to a terminal status, stamping `ended_at` and optional metadata.
   *
   * @param {number} submissionUploadSecurityId The scan event to update.
   * @param {Extract<SubmissionUploadSecurityStatus, 'completed' | 'failed'>} status Terminal status.
   * @param {Record<string, unknown>} [metadata] Optional run details (e.g. rule/insert counts).
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityRepository
   */
  async updateScanEventStatus(
    submissionUploadSecurityId: number,
    status: Extract<SubmissionUploadSecurityStatus, 'completed' | 'failed'>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_upload_security
      SET status = ${status}::submission_upload_security_status,
          ended_at = now(),
          metadata = ${metadata ? JSON.stringify(metadata) : null}::jsonb
      WHERE submission_upload_security_id = ${submissionUploadSecurityId};
    `;

    await this.connection.sql(sqlStatement);
  }
}
