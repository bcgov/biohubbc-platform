import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadReview,
  SubmissionUploadReview,
  UpdateSubmissionUploadReview
} from '../../models/submission-upload-review';
import { BaseRepository } from '../base-repository';

/**
 * Repository for scoped human review tasks on submission uploads.
 *
 * @export
 * @class SubmissionUploadReviewRepository
 * @extends {BaseRepository}
 */
export class SubmissionUploadReviewRepository extends BaseRepository {
  /**
   * Get one active review belonging to a submission upload.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {string} submissionUploadReviewId Submission upload review identifier.
   * @returns {Promise<SubmissionUploadReview>} Matching active review.
   * @memberof SubmissionUploadReviewRepository
   */
  async getSubmissionUploadReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<SubmissionUploadReview> {
    const sqlStatement = SQL`
      SELECT
        sur.submission_upload_review_id,
        sur.submission_upload_id,
        sur.name,
        sur.description,
        sur.scope,
        sur.status,
        sur.requested_by
      FROM submission_upload_review sur
      INNER JOIN submission_upload su
        ON su.submission_upload_id = sur.submission_upload_id
        AND su.record_end_date IS NULL
      WHERE sur.submission_upload_id = ${submissionUploadId}
        AND su.submission_id = ${submissionId}
        AND sur.submission_upload_review_id = ${submissionUploadReviewId}
        AND sur.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Submission upload review not found', [
        'SubmissionUploadReviewRepository->getSubmissionUploadReview',
        { submissionId, submissionUploadId, submissionUploadReviewId }
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get active review rows for a submission upload.
   *
   * @param {string} submissionUploadId - The submission upload ID.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows ordered by create date.
   * @memberof SubmissionUploadReviewRepository
   */
  async findReviewsBySubmissionUploadId(submissionUploadId: string): Promise<SubmissionUploadReview[]> {
    const sqlStatement = SQL`
      SELECT
        sur.submission_upload_review_id,
        sur.submission_upload_id,
        sur.name,
        sur.description,
        sur.scope,
        sur.status,
        sur.requested_by
      FROM
        submission_upload_review sur
      WHERE
        sur.submission_upload_id = ${submissionUploadId}
        AND sur.record_end_date IS NULL
      ORDER BY
        sur.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows;
  }

  /**
   * Insert a submission upload review row.
   *
   * Audit fields, including `create_user`, are set by database triggers from
   * the current connection context.
   *
   * @param {number} submissionId - The submission ID.
   * @param {CreateSubmissionUploadReview} params - Review row values.
   * @return {Promise<SubmissionUploadReview>} The inserted review row.
   * @memberof SubmissionUploadReviewRepository
   */
  async insertSubmissionUploadReview(
    submissionId: number,
    params: CreateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload_review (
        submission_upload_id,
        name,
        description,
        scope,
        status,
        requested_by
      )
      SELECT
        su.submission_upload_id,
        ${params.name},
        ${params.description},
        ${params.scope}::submission_upload_review_scope,
        ${params.status}::submission_upload_review_status,
        ${params.requested_by}
      FROM
        submission_upload su
      WHERE
        su.submission_id = ${submissionId}
        AND su.submission_upload_id = ${params.submission_upload_id}
        AND su.record_end_date IS NULL
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        name,
        description,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [
        'SubmissionUploadReviewRepository->insertSubmissionUploadReview',
        { submissionId, submissionUploadId: params.submission_upload_id }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_upload_review record', [
        'SubmissionUploadReviewRepository->insertSubmissionUploadReview',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active submission upload review row.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @param {UpdateSubmissionUploadReview} data - Review update details.
   * @return {Promise<SubmissionUploadReview>} The updated review row.
   * @memberof SubmissionUploadReviewRepository
   */
  async updateSubmissionUploadReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    data: UpdateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    const sqlStatement = SQL`
      UPDATE submission_upload_review sur
      SET
        status = ${data.status}::submission_upload_review_status
      FROM
        submission_upload su
      INNER JOIN
        submission s
      ON
        s.submission_id = su.submission_id
      WHERE
        sur.submission_upload_review_id = ${submissionUploadReviewId}
        AND sur.submission_upload_id = su.submission_upload_id
        AND su.submission_upload_id = ${submissionUploadId}
        AND s.submission_id = ${submissionId}
        AND su.record_end_date IS NULL
        AND sur.record_end_date IS NULL
      RETURNING
        sur.submission_upload_review_id,
        sur.submission_upload_id,
        sur.name,
        sur.description,
        sur.scope,
        sur.status,
        sur.requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission_upload_review record', [
        'SubmissionUploadReviewRepository->updateSubmissionUploadReview',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active submission upload review identified by its numeric submission ID.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {string} submissionUploadReviewId Submission upload review identifier.
   * @param {UpdateSubmissionUploadReview} data Review update details.
   * @returns {Promise<SubmissionUploadReview>} Updated review.
   * @memberof SubmissionUploadReviewRepository
   */
  async updateSubmissionUploadReviewBySubmissionId(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    data: UpdateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    const sqlStatement = SQL`
      UPDATE submission_upload_review sur
      SET status = ${data.status}::submission_upload_review_status
      FROM submission_upload su
      WHERE sur.submission_upload_review_id = ${submissionUploadReviewId}
        AND sur.submission_upload_id = su.submission_upload_id
        AND su.submission_upload_id = ${submissionUploadId}
        AND su.submission_id = ${submissionId}
        AND su.record_end_date IS NULL
        AND sur.record_end_date IS NULL
      RETURNING
        sur.submission_upload_review_id,
        sur.submission_upload_id,
        sur.name,
        sur.description,
        sur.scope,
        sur.status,
        sur.requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission_upload_review record', [
        'SubmissionUploadReviewRepository->updateSubmissionUploadReviewBySubmissionId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete an active submission upload review row.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @return {Promise<SubmissionUploadReview>} The deleted review row.
   * @memberof SubmissionUploadReviewRepository
   */
  async deleteSubmissionUploadReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<SubmissionUploadReview> {
    const sqlStatement = SQL`
      UPDATE submission_upload_review sur
      SET
        record_end_date = now()
      FROM
        submission_upload su
      INNER JOIN
        submission s
      ON
        s.submission_id = su.submission_id
      WHERE
        sur.submission_upload_review_id = ${submissionUploadReviewId}
        AND sur.submission_upload_id = su.submission_upload_id
        AND su.submission_upload_id = ${submissionUploadId}
        AND s.submission_id = ${submissionId}
        AND su.record_end_date IS NULL
        AND sur.record_end_date IS NULL
      RETURNING
        sur.submission_upload_review_id,
        sur.submission_upload_id,
        sur.name,
        sur.description,
        sur.scope,
        sur.status,
        sur.requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to soft-delete submission_upload_review record', [
        'SubmissionUploadReviewRepository->deleteSubmissionUploadReview',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
