import { SQL } from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadWithTeam,
  SubmissionUpload,
  SubmissionUploadFilters,
  SubmissionUploadJobStatus,
  TicketSubmissionUpload,
  UpdateSubmissionUpload
} from '../../models/submission-upload';
import { SubmissionUploadStatusTypeEnum } from '../../models/submission-upload-review-status';
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
   * @memberof SubmissionUploadRepository
   */
  async getSubmissionUpload(submissionUploadId: string): Promise<SubmissionUpload> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_id,
        submission_id,
        upload_id,
        team_id,
        status,
        ticket_id,
        blueprint_id,
        comment
      FROM
        submission_upload
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUpload);
    const methodLabel = 'SubmissionUploadRepository->getSubmissionUpload';

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [methodLabel, { submissionUploadId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        methodLabel,
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get and lock a single active submission_upload record by ID.
   *
   * Uses `FOR UPDATE` to serialize concurrent workers attempting to start
   * process-stage work for the same submission_upload_id.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record.
   * @returns {Promise<SubmissionUpload>} - The locked submission_upload record.
   * @throws {ApiNotFoundError} - If the record is not found.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
   * @memberof SubmissionUploadRepository
   */
  async getSubmissionUploadWithLock(submissionUploadId: string): Promise<SubmissionUpload> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_id,
        submission_id,
        upload_id,
        team_id,
        status,
        ticket_id,
        blueprint_id,
        successor_submission_upload_id,
        comment
      FROM
        submission_upload
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
      FOR UPDATE;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionUpload);
    const methodLabel = 'SubmissionUploadRepository->getSubmissionUploadWithLock';

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload not found', [methodLabel, { submissionUploadId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        methodLabel,
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
   * @memberof SubmissionUploadRepository
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
        su.team_id,
        su.status,
        su.ticket_id,
        su.blueprint_id,
        su.comment,
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
   * @memberof SubmissionUploadRepository
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
        'submission_upload.team_id',
        'submission_upload.status',
        'submission_upload.ticket_id',
        'submission_upload.blueprint_id',
        'submission_upload.comment'
      )
      .from('submission_upload')
      .join('upload_artifact as ua', 'ua.upload_id', 'submission_upload.upload_id')
      .where('submission_upload.submission_id', submissionId)
      .whereNull('submission_upload.record_end_date')
      .whereNull('ua.record_end_date');

    if (filters?.role) {
      query = query.andWhere('role', filters.role);
    }

    // Apply pagination and sorting
    query = this.applyPagination(query, pagination);

    const response = await this.connection.knex(query, SubmissionUpload);

    return response.rows;
  }

  /**
   * Find ticket-scoped submission upload timeline records.
   *
   * @param {string} ticketId - Ticket UUID.
   * @returns {Promise<TicketSubmissionUpload[]>} Submission upload timeline records associated with the ticket.
   * @memberof SubmissionUploadRepository
   */
  async findSubmissionUploadsByTicketId(ticketId: string): Promise<TicketSubmissionUpload[]> {
    const sqlStatement = SQL`
      SELECT
        su.submission_upload_id,
        s.uuid AS submission_uuid,
        su.upload_id,
        su.create_date,
        s.name AS submission_name,
        s.description AS submission_description,
        su.comment AS submission_comment,
        submitter.user_identifier AS submitted_by_identifier,
        su.status AS upload_status,
        sus.status AS review_status,
        sv.validation,
        json_build_object(
          'validation',
          CASE
            WHEN validation_review.submission_upload_review_id IS NULL THEN NULL
            ELSE json_build_object(
              'submission_upload_review_id', validation_review.submission_upload_review_id,
              'submission_upload_id', validation_review.submission_upload_id,
              'scope', validation_review.scope,
              'status', validation_review.status,
              'requested_by', validation_review.requested_by
            )
          END,
          'security',
          CASE
            WHEN security_review.submission_upload_review_id IS NULL THEN NULL
            ELSE json_build_object(
              'submission_upload_review_id', security_review.submission_upload_review_id,
              'submission_upload_id', security_review.submission_upload_id,
              'scope', security_review.scope,
              'status', security_review.status,
              'requested_by', security_review.requested_by
            )
          END
        ) AS reviews
      FROM
        submission_upload su
      INNER JOIN
        submission s
      ON
        s.submission_id = su.submission_id
      LEFT JOIN
        "system_user" submitter
      ON
        submitter.system_user_id = s.system_user_id
      INNER JOIN LATERAL (
        SELECT
          sus.status
        FROM
          submission_upload_status sus
        WHERE
          sus.submission_upload_id = su.submission_upload_id
          AND sus.status = ANY(${SubmissionUploadStatusTypeEnum.options}::submission_upload_status_type[])
        ORDER BY
          sus.create_date DESC,
          sus.submission_upload_status_id DESC
        LIMIT 1
      ) sus ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_build_object(
            'submission_validation_id', sv.submission_validation_id,
            'job_id', sv.job_id,
            'status', sv.status,
            'metadata', sv.metadata,
            'started_at', sv.started_at,
            'ended_at', sv.ended_at,
            'create_date', sv.create_date
          ) AS validation
        FROM
          submission_validation sv
        WHERE
          sv.submission_upload_id = su.submission_upload_id
        ORDER BY
          sv.create_date DESC
        LIMIT 1
      ) sv ON TRUE
      LEFT JOIN
        submission_upload_review validation_review
      ON
        validation_review.submission_upload_id = su.submission_upload_id
        AND validation_review.scope = 'validation'
        AND validation_review.record_end_date IS NULL
      LEFT JOIN
        submission_upload_review security_review
      ON
        security_review.submission_upload_id = su.submission_upload_id
        AND security_review.scope = 'security'
        AND security_review.record_end_date IS NULL
      WHERE
        su.ticket_id = ${ticketId}
        AND su.record_end_date IS NULL
        AND s.record_end_date IS NULL
      ORDER BY
        su.create_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement, TicketSubmissionUpload);
    return response.rows;
  }

  /**
   * Insert a new submission_upload record and link the prior upload as its predecessor.
   *
   * The caller must serialize submission upload creation before invoking this method. Failed and
   * deleted uploads remain eligible predecessors because upload lineage is append-only.
   *
   * @param {CreateSubmissionUploadWithTeam} submissionUpload - The data to create a new submission_upload.
   * @returns {Promise<{ submission_upload_id: string }>} - The ID of the newly created submission_upload.
   * @throws {ApiExecuteSQLError} - If the insert fails.
   * @memberof SubmissionUploadRepository
   */
  async insertSubmissionUpload(
    submissionUpload: CreateSubmissionUploadWithTeam
  ): Promise<{ submission_upload_id: string }> {
    const sqlStatement = SQL`
      WITH predecessor AS (
        SELECT submission_upload_id
        FROM submission_upload
        WHERE submission_id = ${submissionUpload.submission_id}
        ORDER BY create_date DESC, submission_upload_id DESC
        LIMIT 1
        FOR UPDATE
      ),
      inserted AS (
        INSERT INTO submission_upload (
          submission_id,
          upload_id,
          team_id,
          ticket_id,
          status,
          blueprint_id,
          comment
        ) VALUES (
          ${submissionUpload.submission_id},
          ${submissionUpload.upload_id},
          ${submissionUpload.team_id},
          ${submissionUpload.ticket_id},
          ${submissionUpload.status},
          ${submissionUpload.blueprint_id},
          ${submissionUpload.comment ?? null}
        )
        RETURNING submission_upload_id
      ),
      linked AS (
        UPDATE submission_upload prior
        SET successor_submission_upload_id = inserted.submission_upload_id
        FROM predecessor, inserted
        WHERE prior.submission_upload_id = predecessor.submission_upload_id
          AND prior.successor_submission_upload_id IS NULL
        RETURNING prior.submission_upload_id
      )
      SELECT inserted.submission_upload_id
      FROM inserted
      WHERE NOT EXISTS (SELECT 1 FROM predecessor)
        OR EXISTS (SELECT 1 FROM linked);
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ submission_upload_id: z.string() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_upload record', [
        'SubmissionUploadRepository->insertSubmissionUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find the `blueprint_id` of the most recent prior submission_upload for a submission.
   *
   * Used to pin a new upload to the same Blueprint as the submission's previous upload, so
   * re-submissions remain stable when the default Blueprint changes. The most recent upload is
   * selected by `create_date` regardless of `record_end_date` — a soft-deleted prior upload's
   * Blueprint is still a valid pin.
   *
   * @param {number} submissionId - The submission whose prior uploads should be inspected.
   * @returns {Promise<number | null>} - The prior upload's `blueprint_id`, or null if none exists.
   * @memberof SubmissionUploadRepository
   */
  async findMostRecentBlueprintIdBySubmissionId(submissionId: number): Promise<number | null> {
    const sqlStatement = SQL`
      SELECT
        blueprint_id
      FROM
        submission_upload
      WHERE
        submission_id = ${submissionId}
      ORDER BY
        create_date DESC,
        submission_upload_id DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ blueprint_id: z.number() }));

    return response.rows[0]?.blueprint_id ?? null;
  }

  /**
   * Update an existing submission_upload record.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record to update.
   * @param {UpdateSubmissionUpload} submissionUpload - The updated data for the record.
   * @returns {Promise<{ submission_upload_id: string }>} - The ID of the updated submission_upload.
   * @throws {ApiExecuteSQLError} - If the update fails.
   * @memberof SubmissionUploadRepository
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
   * Set the processing status of an active submission_upload record.
   *
   * Only `SubmissionUploadService.transitionSubmissionUploadStatus` should call this: it holds the
   * row lock, validates the transition and records the history row around this write.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record to update.
   * @param {SubmissionUploadJobStatus} status - The processing status to persist.
   * @returns {Promise<{ submission_upload_id: string }>} - The ID of the updated submission_upload.
   * @throws {ApiExecuteSQLError} - If no active record was updated.
   * @memberof SubmissionUploadRepository
   */
  async updateSubmissionUploadStatus(
    submissionUploadId: string,
    status: SubmissionUploadJobStatus
  ): Promise<{ submission_upload_id: string }> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET
        status = ${status}
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
      RETURNING submission_upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update submission_upload status', [
        'SubmissionUploadRepository->updateSubmissionUploadStatus',
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
   * @memberof SubmissionUploadRepository
   */
  async getSubmissionUploadByUploadId(uploadId: string): Promise<SubmissionUpload> {
    const sqlStatement = SQL`
      SELECT
        submission_upload_id,
        submission_id,
        upload_id,
        team_id,
        status,
        ticket_id,
        blueprint_id,
        comment
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
   * @returns {Promise<void>} Resolves after the active upload row has been soft-deleted.
   * @throws {ApiExecuteSQLError} - If no active record is found.
   * @memberof SubmissionUploadRepository
   */
  async softDeleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET record_end_date = NOW()
      WHERE submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
      RETURNING submission_upload_id;
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
   * @memberof SubmissionUploadRepository
   */
  async softDeleteSubmissionUploadsBySubmissionId(submissionId: number): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET record_end_date = NOW()
      WHERE submission_id = ${submissionId}
        AND record_end_date IS NULL
      RETURNING submission_upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
  }

  /**
   * Lock all active upload rows for a submission in a deterministic order.
   *
   * This serializes bulk upload mutations with single-upload approval and deletion operations.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<void>} Resolves after every active upload row for the submission is locked.
   * @memberof SubmissionUploadRepository
   */
  async lockSubmissionUploadsForSubmissionId(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      SELECT submission_upload_id
      FROM submission_upload
      WHERE submission_id = ${submissionId}
        AND record_end_date IS NULL
      ORDER BY submission_upload_id
      FOR UPDATE;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft-delete a single active submission_upload record by ID.
   *
   * @param {string} submissionUploadId - The ID of the submission_upload record to soft-delete.
   * @returns {Promise<void>} Resolves after the active upload row has been soft-deleted.
   * @throws {ApiExecuteSQLError} - If the soft-delete fails.
   * @memberof SubmissionUploadRepository
   */
  async deleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_upload
      SET record_end_date = NOW()
      WHERE submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
      RETURNING submission_upload_id;
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
