import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus,
  SubmissionUploadReviewStatusHistoryRow,
  UpdateSubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { BaseRepository } from '../base-repository';

/**
 * Repository for managing submission_upload_status records.
 * Tracks the admin review status (submitted, approved, denied) for each submission upload.
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
   * Get the review status for a submission upload.
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
        submission_upload_id = ${submissionUploadId};
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
   * Update the review status for a submission upload.
   *
   * @param {string} submissionUploadId - The submission_upload_id whose status should be updated.
   * @param {UpdateSubmissionUploadReviewStatus} data - The new status value.
   * @returns {Promise<SubmissionUploadReviewStatus>} - The updated status record.
   * @throws {ApiExecuteSQLError} - If the update fails.
   */
  async updateSubmissionUploadReviewStatus(
    submissionUploadId: string,
    data: UpdateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    const sqlStatement = SQL`
      UPDATE submission_upload_status
      SET
        status = ${data.status}
      WHERE
        submission_upload_id = ${submissionUploadId}
      RETURNING submission_upload_status_id, submission_upload_id, status;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReviewStatus);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission_upload_status record', [
        'SubmissionUploadReviewStatusRepository->updateSubmissionUploadReviewStatus',
        `rowCount was ${response.rowCount}, expected 1`
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
        sus.create_date DESC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReviewStatusHistoryRow);

    return response.rows;
  }
}
