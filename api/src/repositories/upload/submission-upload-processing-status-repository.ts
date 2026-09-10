import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { SubmissionUploadJobStatus } from '../../models/submission-upload';
import {
  SubmissionUploadProcessingStatus,
  SubmissionUploadProcessingStatusHistoryRow
} from '../../models/submission-upload-processing-status';
import { BaseRepository } from '../base-repository';

/**
 * Repository for the processing status transition log `submission_upload_status`.
 *
 * `submission_upload.status` stays the authoritative current status; these rows are its history.
 */
export class SubmissionUploadProcessingStatusRepository extends BaseRepository {
  /**
   * Insert an active processing status row.
   *
   * `create_date` is populated by the audit trigger.
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
        create_date;
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
        AND status = ANY(${statuses}::submission_upload_job_status[]);
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
  }

  /**
   * Find the active processing status history of an upload that belongs to a submission, earliest
   * first, in one query.
   *
   * Returns no rows when the upload does not exist, is not active, or is not in the submission.
   * Returns exactly one row with null status columns when the upload exists but has no processing
   * history rows. Otherwise returns one row per active processing status.
   *
   * @param {string} submissionUuid - Submission the upload must belong to.
   * @param {string} submissionUploadId - Submission upload whose history is requested.
   * @returns {Promise<SubmissionUploadProcessingStatusHistoryRow[]>} - Rows ordered by create_date, then id.
   * @memberof SubmissionUploadProcessingStatusRepository
   */
  async findSubmissionUploadProcessingStatusHistory(
    submissionUuid: string,
    submissionUploadId: string
  ): Promise<SubmissionUploadProcessingStatusHistoryRow[]> {
    const sqlStatement = SQL`
      SELECT
        su.submission_upload_id,
        sus.submission_upload_status_id,
        sus.status,
        sus.create_date
      FROM
        submission_upload su
      INNER JOIN submission s ON s.submission_id = su.submission_id
      LEFT JOIN submission_upload_status sus
        ON sus.submission_upload_id = su.submission_upload_id
        AND sus.record_end_date IS NULL
      WHERE
        s.uuid = ${submissionUuid}
        AND su.submission_upload_id = ${submissionUploadId}
        AND su.record_end_date IS NULL
      ORDER BY
        sus.create_date ASC,
        sus.submission_upload_status_id ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadProcessingStatusHistoryRow);

    return response.rows;
  }
}
