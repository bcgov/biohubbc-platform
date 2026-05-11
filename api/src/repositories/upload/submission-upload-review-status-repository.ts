import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus,
  SubmissionUploadReviewStatusHistoryRow
} from '../../models/submission-upload-review-status';
import { BaseRepository } from '../base-repository';

/**
 * Repository for managing submission_upload_status records.
 * Tracks immutable admin review status decisions for each submission upload.
 */
export class SubmissionUploadReviewStatusRepository extends BaseRepository {
  /**
   * Insert a new submission_upload_status record.
   *
   * @param {CreateSubmissionUploadReviewStatus} data - The status data to insert.
   * @returns {Promise<SubmissionUploadReviewStatus>} - The newly created status record.
   * @throws {ApiExecuteSQLError} - If the insert fails.
   */
  async insertSubmissionUploadReviewStatus(
    data: CreateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload_status (
        submission_upload_id,
        status
      ) VALUES (
        ${data.submission_upload_id},
        ${data.status}
      )
      RETURNING submission_upload_status_id, submission_upload_id, status;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReviewStatus);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_upload_status record', [
        'SubmissionUploadReviewStatusRepository->insertSubmissionUploadReviewStatus',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get the latest review status for a submission upload.
   *
   * @param {string} submissionUploadId - The submission_upload_id to look up.
   * @returns {Promise<SubmissionUploadReviewStatus>} - The status record.
   * @throws {ApiNotFoundError} - If the record is not found.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
   */
  async getSubmissionUploadReviewStatus(submissionUploadId: string): Promise<SubmissionUploadReviewStatus> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_status_id,
        submission_upload_id,
        status
      FROM
        submission_upload_status
      WHERE
        submission_upload_id = ${submissionUploadId}
      ORDER BY
        create_date DESC,
        submission_upload_status_id DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReviewStatus);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload status not found', [
        'SubmissionUploadReviewStatusRepository->getSubmissionUploadReviewStatus',
        { submissionUploadId }
      ]);
    }
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadReviewStatusRepository->getSubmissionUploadReviewStatus',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all submission_upload_status records for a submission (publish history), newest first.
   *
   * @param {string} submissionUuid - The submission UUID to look up.
   * @returns {Promise<SubmissionUploadReviewStatusHistoryRow[]>} - All status records for the submission.
   */
  async getStatusHistoryBySubmissionUuid(submissionUuid: string): Promise<SubmissionUploadReviewStatusHistoryRow[]> {
    const sqlStatement = SQL`
      SELECT
        s.submission_id,
        sus.submission_upload_id,
        sus.status,
        sus.create_date
      FROM
        submission_upload_status sus
      INNER JOIN submission_upload su ON su.submission_upload_id = sus.submission_upload_id
      INNER JOIN submission s ON s.submission_id = su.submission_id
      WHERE
        s.uuid = ${submissionUuid}
      ORDER BY
        sus.create_date DESC,
        sus.submission_upload_status_id DESC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReviewStatusHistoryRow);

    return response.rows;
  }
}
