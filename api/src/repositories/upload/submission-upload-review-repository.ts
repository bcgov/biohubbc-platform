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
   * @param {string} submissionUuid - The submission UUID.
   * @param {CreateSubmissionUploadReview} params - Review row values.
   * @return {Promise<SubmissionUploadReview>} The inserted review row.
   * @memberof SubmissionUploadReviewRepository
   */
  async insertSubmissionUploadReview(
    submissionUuid: string,
    params: CreateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload_review (
        submission_upload_id,
        scope,
        requested_by
      )
      SELECT
        su.submission_upload_id,
        ${params.scope}::submission_upload_review_scope,
        ${params.requested_by}
      FROM
        submission_upload su
      INNER JOIN
        submission s
      ON
        s.submission_id = su.submission_id
      WHERE
        s.uuid = ${submissionUuid}
        AND su.submission_upload_id = ${params.submission_upload_id}
        AND su.record_end_date IS NULL
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [
        'SubmissionUploadReviewRepository->insertSubmissionUploadReview',
        { submissionUuid, submissionUploadId: params.submission_upload_id }
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
   * Insert the default validation and security review rows for a submission upload.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {number} requestedBy - The system user ID requesting the reviews.
   * @return {Promise<SubmissionUploadReview[]>} The inserted review rows.
   * @memberof SubmissionUploadReviewRepository
   */
  async insertDefaultSubmissionUploadReviews(
    submissionId: number,
    submissionUploadId: string,
    requestedBy: number
  ): Promise<SubmissionUploadReview[]> {
    const sqlStatement = SQL`
      WITH requested_scopes(scope, sort_order) AS (
        VALUES
          ('validation'::submission_upload_review_scope, 1),
          ('security'::submission_upload_review_scope, 2)
      )
      INSERT INTO submission_upload_review (
        submission_upload_id,
        scope,
        requested_by
      )
      SELECT
        su.submission_upload_id,
        rs.scope,
        ${requestedBy}
      FROM
        submission_upload su
      CROSS JOIN
        requested_scopes rs
      WHERE
        su.submission_id = ${submissionId}
        AND su.submission_upload_id = ${submissionUploadId}
        AND su.record_end_date IS NULL
      ORDER BY
        rs.sort_order ASC
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [
        'SubmissionUploadReviewRepository->insertDefaultSubmissionUploadReviews',
        { submissionId, submissionUploadId }
      ]);
    }

    if (response.rowCount !== 2) {
      throw new ApiExecuteSQLError('Failed to insert default submission_upload_review records', [
        'SubmissionUploadReviewRepository->insertDefaultSubmissionUploadReviews',
        'rowCount was null or undefined, expected rowCount = 2'
      ]);
    }

    return response.rows;
  }

  /**
   * Update an active submission upload review row.
   *
   * @param {string} submissionUuid - The submission UUID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @param {UpdateSubmissionUploadReview} data - Review update details.
   * @return {Promise<SubmissionUploadReview>} The updated review row.
   * @memberof SubmissionUploadReviewRepository
   */
  async updateSubmissionUploadReview(
    submissionUuid: string,
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
        AND s.uuid = ${submissionUuid}
        AND su.record_end_date IS NULL
        AND sur.record_end_date IS NULL
      RETURNING
        sur.submission_upload_review_id,
        sur.submission_upload_id,
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
   * Soft delete an active submission upload review row.
   *
   * @param {string} submissionUuid - The submission UUID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @return {Promise<SubmissionUploadReview>} The deleted review row.
   * @memberof SubmissionUploadReviewRepository
   */
  async deleteSubmissionUploadReview(
    submissionUuid: string,
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
        AND s.uuid = ${submissionUuid}
        AND su.record_end_date IS NULL
        AND sur.record_end_date IS NULL
      RETURNING
        sur.submission_upload_review_id,
        sur.submission_upload_id,
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
