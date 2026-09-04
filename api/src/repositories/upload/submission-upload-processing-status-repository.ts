import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SubmissionUploadJobStatus } from '../../models/submission-upload';
import { SubmissionUploadProcessingStatus } from '../../models/submission-upload-processing-status';
import { BaseRepository } from '../base-repository';
import { processingStatusPredicate } from './submission-upload-status-predicates';

/**
 * Repository for the processing status rows in `submission_upload_status`.
 *
 * The table also holds review decision rows; every statement here filters on the processing
 * status values so the two row classes never mix. `submission_upload.status` stays the
 * authoritative current status; these rows are its history.
 */
export class SubmissionUploadProcessingStatusRepository extends BaseRepository {
  /**
   * Insert an active processing status row.
   *
   * `create_user` and `create_date` are populated by the audit trigger.
   *
   * @param {string} submissionUploadId - Submission upload the status belongs to.
   * @param {SubmissionUploadJobStatus} status - Processing status entered.
   * @returns {Promise<SubmissionUploadProcessingStatus>} - The inserted row.
   * @throws {ApiExecuteSQLError} - If the insert does not return exactly one row.
   * @memberof SubmissionUploadProcessingStatusRepository
   */
  async insertSubmissionUploadProcessingStatus(
    submissionUploadId: string,
    status: SubmissionUploadJobStatus
  ): Promise<SubmissionUploadProcessingStatus> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload_status (
        submission_upload_id,
        status
      ) VALUES (
        ${submissionUploadId},
        ${status}
      )
      RETURNING
        submission_upload_status_id,
        submission_upload_id,
        status,
        record_end_date,
        create_date,
        create_user;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadProcessingStatus);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_upload_status processing record', [
        'SubmissionUploadProcessingStatusRepository->insertSubmissionUploadProcessingStatus',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * End-date the active processing status rows for an upload whose status is in `statuses`.
   *
   * Rows are soft-ended, never deleted, so a superseded attempt stays in the history.
   *
   * @param {string} submissionUploadId - Submission upload whose rows are superseded.
   * @param {SubmissionUploadJobStatus[]} statuses - Statuses whose active rows should be ended.
   * @returns {Promise<number>} - Number of rows ended.
   * @memberof SubmissionUploadProcessingStatusRepository
   */
  async endActiveSubmissionUploadProcessingStatuses(
    submissionUploadId: string,
    statuses: SubmissionUploadJobStatus[]
  ): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_upload_status
      SET
        record_end_date = now()
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
        AND status = ANY(${statuses}::submission_upload_status_type[]);
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
  }

  /**
   * Find the active processing status rows for an upload, earliest first.
   *
   * @param {string} submissionUploadId - Submission upload whose history is requested.
   * @returns {Promise<SubmissionUploadProcessingStatus[]>} - Active rows ordered by create_date, then id.
   * @memberof SubmissionUploadProcessingStatusRepository
   */
  async findActiveSubmissionUploadProcessingStatuses(
    submissionUploadId: string
  ): Promise<SubmissionUploadProcessingStatus[]> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_status_id,
        submission_upload_id,
        status,
        record_end_date,
        create_date,
        create_user
      FROM
        submission_upload_status
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
        AND `
      .append(processingStatusPredicate('status'))
      .append(
        SQL`
      ORDER BY
        create_date ASC,
        submission_upload_status_id ASC;
    `
      );

    const response = await this.connection.sql(sqlStatement, SubmissionUploadProcessingStatus);

    return response.rows;
  }
}
