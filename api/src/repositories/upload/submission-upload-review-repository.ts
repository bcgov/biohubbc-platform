import { SQL } from 'sql-template-strings';
import {
  CreateSubmissionUploadReview,
  SubmissionUploadReview,
  SubmissionUploadReviewFilters,
  SubmissionUploadReviewUpdate
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
   * @param {SubmissionUploadReviewFilters} [filters] - Optional review filters.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows ordered by create date.
   * @memberof SubmissionUploadReviewRepository
   */
  async findReviewsBySubmissionUploadId(
    submissionUploadId: string,
    filters?: SubmissionUploadReviewFilters
  ): Promise<SubmissionUploadReview[]> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by
      FROM
        submission_upload_review
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
    `;

    if (filters?.scope) {
      sqlStatement.append(SQL`
        AND scope = ${filters.scope}::submission_upload_review_scope
      `);
    }

    if (filters?.status) {
      sqlStatement.append(SQL`
        AND status = ${filters.status}::submission_upload_review_status
      `);
    }

    sqlStatement.append(SQL`
      ORDER BY
        create_date ASC;
    `);

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows;
  }

  /**
   * Get active review rows for multiple submission uploads.
   *
   * @param {string[]} submissionUploadIds - The submission upload IDs.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows ordered by upload and create date.
   * @memberof SubmissionUploadReviewRepository
   */
  async findReviewsBySubmissionUploadIds(submissionUploadIds: string[]): Promise<SubmissionUploadReview[]> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by
      FROM
        submission_upload_review
      WHERE
        submission_upload_id = ANY(${submissionUploadIds}::uuid[])
        AND record_end_date IS NULL
      ORDER BY
        submission_upload_id ASC,
        create_date ASC;
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
   * @param {CreateSubmissionUploadReview} params - Review row values.
   * @return {Promise<SubmissionUploadReview | undefined>} The inserted review row, if one was inserted.
   * @memberof SubmissionUploadReviewRepository
   */
  async insertSubmissionUploadReview(
    params: CreateSubmissionUploadReview
  ): Promise<SubmissionUploadReview | undefined> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload_review (
        submission_upload_id,
        scope,
        requested_by
      )
      VALUES (
        ${params.submission_upload_id},
        ${params.scope}::submission_upload_review_scope,
        ${params.requested_by}
      )
      ON CONFLICT (submission_upload_id, scope)
      WHERE record_end_date IS NULL
      DO NOTHING
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows[0];
  }

  /**
   * Update an active submission upload review row.
   *
   * @param {{ submissionUploadId: string; submissionUploadReviewId: string; data: SubmissionUploadReviewUpdate }} params - Review update details.
   * @return {Promise<SubmissionUploadReview | undefined>} The updated review row, if found.
   * @memberof SubmissionUploadReviewRepository
   */
  async updateSubmissionUploadReview(params: {
    submissionUploadId: string;
    submissionUploadReviewId: string;
    data: SubmissionUploadReviewUpdate;
  }): Promise<SubmissionUploadReview | undefined> {
    const sqlStatement = SQL`
      UPDATE submission_upload_review
      SET
        status = ${params.data.status}::submission_upload_review_status
      WHERE
        submission_upload_review_id = ${params.submissionUploadReviewId}
        AND submission_upload_id = ${params.submissionUploadId}
        AND record_end_date IS NULL
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows[0];
  }

  /**
   * Update an active review row's workflow status by review ID.
   *
   * This supports the ID-only admin update route.
   *
   * @param {{ submissionUploadReviewId: string; data: SubmissionUploadReviewUpdate }} params - Review status update.
   * @return {Promise<SubmissionUploadReview | undefined>} The updated review row, if found.
   * @memberof SubmissionUploadReviewRepository
   */
  async updateReviewStatus(params: {
    submissionUploadReviewId: string;
    data: SubmissionUploadReviewUpdate;
  }): Promise<SubmissionUploadReview | undefined> {
    const sqlStatement = SQL`
      UPDATE submission_upload_review
      SET
        status = ${params.data.status}::submission_upload_review_status
      WHERE
        submission_upload_review_id = ${params.submissionUploadReviewId}
        AND record_end_date IS NULL
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows[0];
  }

  /**
   * Soft delete an active submission upload review row.
   *
   * @param {{ submissionUploadId: string; submissionUploadReviewId: string }} params - Review delete details.
   * @return {Promise<SubmissionUploadReview | undefined>} The deleted review row, if found.
   * @memberof SubmissionUploadReviewRepository
   */
  async deleteSubmissionUploadReview(params: {
    submissionUploadId: string;
    submissionUploadReviewId: string;
  }): Promise<SubmissionUploadReview | undefined> {
    const sqlStatement = SQL`
      UPDATE submission_upload_review
      SET
        record_end_date = now()
      WHERE
        submission_upload_review_id = ${params.submissionUploadReviewId}
        AND submission_upload_id = ${params.submissionUploadId}
        AND record_end_date IS NULL
      RETURNING
        submission_upload_review_id,
        submission_upload_id,
        scope,
        status,
        requested_by;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUploadReview);
    return response.rows[0];
  }
}
