import { SQL } from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUpload,
  SubmissionUpload,
  SubmissionUploadFilters,
  UpdateSubmissionUpload
} from '../../models/submission-upload';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

export class SubmissionUploadRepository extends BaseRepository {
  /**
   * Get a single active submission_upload record by ID.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record.
   * @returns {Promise<SubmissionUpload>} - The requested submission_upload record.
   * @throws {ApiNotFoundError} - If the record is not found.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
   */
  async getSubmissionUpload(submissionUploadId: string): Promise<SubmissionUpload> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_id,
        submission_id,
        upload_id,
        status,
        ticket_id
      FROM
        submission_upload
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUpload);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [
        'SubmissionUploadRepository->getSubmissionUpload',
        { submissionUploadId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadRepository->getSubmissionUpload',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single active submission_upload record by submission UUID and submission_upload_id.
   * Use to validate that an upload belongs to the given submission (e.g. path parameter validation).
   *
   * @param {string} submissionUuid - The submission UUID (submission.uuid).
   * @param {string} submissionUploadId - The submission_upload_id.
   * @returns {Promise<SubmissionUpload>} - The requested submission_upload record.
   * @throws {ApiNotFoundError} - If the record is not found or does not belong to the submission.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
   */
  async getSubmissionUploadBySubmissionUuid(
    submissionUuid: string,
    submissionUploadId: string
  ): Promise<SubmissionUpload> {
    const sqlStatement = SQL`
      SELECT
        su.submission_upload_id,
        su.submission_id,
        su.upload_id,
        su.status,
        su.ticket_id,
        su.record_end_date
      FROM
        submission_upload su
      INNER JOIN submission s ON s.submission_id = su.submission_id
      WHERE
        s.uuid = ${submissionUuid}
        AND su.submission_upload_id = ${submissionUploadId}
        AND su.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUpload);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [
        'SubmissionUploadRepository->getSubmissionUploadBySubmissionUuid',
        { submissionUuid, submissionUploadId }
      ]);
    }
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadRepository->getSubmissionUploadBySubmissionUuid',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Retrieves submission_upload records with optional filters and pagination.
   *
   * @param {number} submissionId - The ID of the submission.
   * @param {SubmissionUploadFilters} filters - Filters to apply to the query (e.g., type).
   * @param {ApiPaginationOptions} [pagination] - Pagination options to limit and offset results.
   * @returns {Promise<SubmissionUpload[]>} - A list of submission_upload records matching the filters.
   */
  async getSubmissionUploadsBySubmissionId(
    submissionId: number,
    filters?: SubmissionUploadFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SubmissionUpload[]> {
    const knex = getKnex();

    let query = knex
      .select(
        'submission_upload.submission_upload_id',
        'submission_upload.submission_id',
        'submission_upload.upload_id',
        'submission_upload.status',
        'submission_upload.ticket_id'
      )
      .from('submission_upload')
      .join('upload_artifact as ua', 'ua.upload_id', 'submission_upload.upload_id')
      .where('submission_upload.submission_id', submissionId)
      .whereNull('submission_upload.record_end_date');

    if (filters?.role) {
      query = query.andWhere('role', filters.role);
    }

    // Apply pagination and sorting
    query = this.applyPagination(query, pagination);

    const response = await this.connection.knex(query, SubmissionUpload);

    return response.rows;
  }

  /**
   * Insert a new submission_upload record.
   *
   * @param {CreateSubmissionUpload} submissionUpload - The data to create a new submission_upload.
   * @returns {Promise<{ submission_upload_id: string }>} - The ID of the newly created submission_upload.
   * @throws {ApiExecuteSQLError} - If the insert fails.
   */
  async insertSubmissionUpload(submissionUpload: CreateSubmissionUpload): Promise<{ submission_upload_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload (
        submission_id,
        upload_id,
        ticket_id
      ) VALUES (
        ${submissionUpload.submission_id},
        ${submissionUpload.upload_id},
        ${submissionUpload.ticket_id}
      )
      RETURNING submission_upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_upload record', [
        'SubmissionUploadRepository->insertSubmissionUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert submission_upload records for a given upload_id.
   *
   * @param {number} submissionId - The ID of the submission.
   * @param {string} uploadId - The ID of the upload.
   * @param {string} ticketId - The ID of the associated ticket.
   * @returns {Promise<{ submission_upload_id: string }[]>} - The list of newly created submission_upload records.
   * @throws {ApiExecuteSQLError} - If the insert fails.
   */
  async insertSubmissionUploadsForUploadId(
    submissionId: number,
    uploadId: string,
    ticketId: string
  ): Promise<{ submission_upload_id: string }[]> {
    const sqlStatement = SQL`
      INSERT INTO submission_upload (
        submission_id,
        upload_id,
        ticket_id
      )
      SELECT
        ${submissionId},
        ua.upload_id,
        ${ticketId}
      FROM upload_artifact ua
      WHERE ua.upload_id = ${uploadId}
      RETURNING submission_upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to insert submission_upload records', [
        'SubmissionUploadRepository->insertSubmissionUploadsForUploadId',
        `rowCount was ${response.rowCount}, expected >= 1`,
        `upload_id = ${uploadId}`,
        `submission_id = ${submissionId}`
      ]);
    }

    return response.rows;
  }

  /**
   * Update an existing submission_upload record.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record to update.
   * @param {UpdateSubmissionUpload} submissionUpload - The updated data for the record.
   * @returns {Promise<{ submission_upload_id: string }>} - The ID of the updated submission_upload.
   * @throws {ApiExecuteSQLError} - If the update fails.
   */
  async updateSubmissionUpload(
    submissionUploadId: string,
    submissionUpload: UpdateSubmissionUpload
  ): Promise<{ submission_upload_id: string }> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET
        submission_id = COALESCE(${submissionUpload.submission_id}, submission_id),
        upload_id = COALESCE(${submissionUpload.upload_id}, upload_id),
        status = COALESCE(${submissionUpload.status}, status),
        ticket_id = COALESCE(${submissionUpload.ticket_id}, ticket_id)
      WHERE
        submission_upload_id = ${submissionUploadId}
      RETURNING submission_upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission_upload record', [
        'SubmissionUploadRepository->updateSubmissionUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get an active submission_upload record by upload_id (reverse lookup).
   *
   * @param {string} uploadId - The upload_id to look up.
   * @returns {Promise<SubmissionUpload>} - The submission_upload record.
   * @throws {ApiNotFoundError} - If the record is not found.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
   */
  async getSubmissionUploadByUploadId(uploadId: string): Promise<SubmissionUpload> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_id,
        submission_id,
        upload_id,
        status,
        ticket_id
      FROM
        submission_upload
      WHERE
        upload_id = ${uploadId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUpload);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [
        'SubmissionUploadRepository->getSubmissionUploadByUploadId',
        { uploadId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadRepository->getSubmissionUploadByUploadId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft-delete a single active submission_upload record by setting record_end_date to now.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record to soft-delete.
   * @throws {ApiExecuteSQLError} - If no active record is found.
   */
  async softDeleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET record_end_date = NOW()
      WHERE submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to soft-delete submission_upload record', [
        'SubmissionUploadRepository->softDeleteSubmissionUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }

  /**
   * Soft-delete all active submission_upload records for a given submission.
   *
   * @param {number} submissionId - The submission ID whose uploads should be soft-deleted.
   * @returns {Promise<number>} - The number of records soft-deleted.
   */
  async softDeleteSubmissionUploadsBySubmissionId(submissionId: number): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET record_end_date = NOW()
      WHERE submission_id = ${submissionId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
  }

  /**
   * Soft-delete a single active submission_upload record by ID.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record to soft-delete.
   * @throws {ApiExecuteSQLError} - If the soft-delete fails.
   */
  async deleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET record_end_date = NOW()
      WHERE submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to soft-delete submission_upload record', [
        'SubmissionUploadRepository->deleteSubmissionUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}
