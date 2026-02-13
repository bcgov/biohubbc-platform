import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  Comment,
  CreateDataRequest,
  DataRequest,
  DataRequestFilters,
  DataRequestStatus,
  DataRequestStatusEnum,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { BaseRepository } from './base-repository';

/**
 * Data request repository class.
 *
 * @export
 * @class DataRequestRepository
 * @extends {BaseRepository}
 */
export class DataRequestRepository extends BaseRepository {
  /**
   * Find all data requests, optionally filtered by date range, requested_by, or team_id.
   *
   * @param {object} [filters]
   * @param {string} [filters.date_from]
   * @param {string} [filters.date_to]
   * @param {number} [filters.requested_by]
   * @param {string} [filters.team_id]
   * @return {Promise<DataRequest[]>}
   * @memberof DataRequestRepository
   */
  async findDataRequests(filters?: {
    date_from?: string;
    date_to?: string;
    requested_by?: number;
    team_id?: string;
  }): Promise<DataRequest[]> {
    const knex = getKnex();
    const query = knex('data_request').whereNull('record_end_date').select('*');

    if (filters?.date_from) {
      query.where('create_date', '>=', filters.date_from);
    }
    if (filters?.date_to) {
      query.where('create_date', '<=', filters.date_to);
    }
    if (filters?.requested_by) {
      query.where('requested_by', filters.requested_by);
    }
    if (filters?.team_id) {
      query.where('team_id', filters.team_id);
    }

    const response = await this.connection.knex(query, DataRequest);
    return response.rows;
  }

  /**
   * Get a specific data request by its ID. Throws an error if the data request does not exist.
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequest>}
   * @memberof DataRequestRepository
   */
  async getDataRequestById(dataRequestId: string): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request').where('data_request_id', dataRequestId).whereNull('record_end_date').select('*');

    const response = await this.connection.knex(query, DataRequest);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get data request', [
        'DataRequestRepository->getDataRequestById',
        'rowCount !== 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Find a specific data request by its ID.
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequest | null>}
   * @memberof DataRequestRepository
   */
  async findDataRequestById(dataRequestId: string): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request').where('data_request_id', dataRequestId).whereNull('record_end_date').select('*');

    const response = await this.connection.knex(query, DataRequest);

    return response.rows[0] ?? null;
  }

  /**
   * Find a list of data_requests by status and optional filters.
   *
   * @param {object} params
   * @param {RequestStatus} params.status - Status to filter by (REQUESTED, APPROVED, DENIED).
   * @param {DataRequestFilters} [params.filters] - Optional filters (date_from, date_to, requested_by, team_id).
   * @return {Promise<DataRequestWithStatus[]>}
   * @memberof DataRequestRepository
   */
  async findDataRequestsByStatus({
    status,
    filters
  }: {
    status: DataRequestStatusEnum;
    filters?: DataRequestFilters;
  }): Promise<DataRequestWithStatus[]> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .join('data_request_status as drs', function () {
        this.on('dr.data_request_id', '=', 'drs.data_request_id').onNull('drs.record_end_date');
      })
      .whereNull('dr.record_end_date')
      .where('drs.request_status', status)
      .select(
        'dr.data_request_id',
        'dr.reason',
        'dr.team_id',
        'dr.requested_by',
        'dr.record_end_date',
        'dr.create_date',
        'dr.create_user',
        'dr.update_date',
        'dr.update_user',
        'dr.revision_count',
        'drs.data_request_status_id',
        'drs.data_request_id as drs_data_request_id',
        'drs.comment_id as drs_comment_id',
        'drs.request_status as drs_request_status',
        'drs.record_end_date as drs_record_end_date',
        'drs.create_date as drs_create_date',
        'drs.create_user as drs_create_user',
        'drs.update_date as drs_update_date',
        'drs.update_user as drs_update_user',
        'drs.revision_count as drs_revision_count'
      );

    if (filters?.date_from) {
      query.where('dr.create_date', '>=', filters.date_from);
    }
    if (filters?.date_to) {
      query.where('dr.create_date', '<=', filters.date_to);
    }
    if (filters?.requested_by !== undefined) {
      query.where('dr.requested_by', filters.requested_by);
    }
    if (filters?.team_id) {
      query.where('dr.team_id', filters.team_id);
    }

    const response = await this.connection.knex(query);

    const rows = response.rows as Array<{
      data_request_id: string;
      reason: string;
      team_id: string;
      requested_by: number;
      record_end_date: string | null;
      create_date: string;
      create_user: number;
      update_date: string | null;
      update_user: number | null;
      revision_count: number;
      data_request_status_id: string;
      drs_data_request_id: string;
      drs_comment_id: string | null;
      drs_request_status: DataRequestStatusEnum;
      drs_record_end_date: string | null;
      drs_create_date: string;
      drs_create_user: number;
      drs_update_date: string | null;
      drs_update_user: number | null;
      drs_revision_count: number;
    }>;

    return rows.map(
      (row): DataRequestWithStatus => ({
        data_request_id: row.data_request_id,
        reason: row.reason,
        team_id: row.team_id,
        requested_by: row.requested_by,
        record_end_date: row.record_end_date,
        create_date: row.create_date,
        create_user: row.create_user,
        update_date: row.update_date,
        update_user: row.update_user,
        revision_count: row.revision_count,
        data_request_status: {
          data_request_status_id: row.data_request_status_id,
          data_request_id: row.drs_data_request_id,
          comment_id: row.drs_comment_id,
          request_status: row.drs_request_status,
          record_end_date: row.drs_record_end_date,
          create_date: row.drs_create_date,
          create_user: row.drs_create_user,
          update_date: row.drs_update_date,
          update_user: row.drs_update_user,
          revision_count: row.drs_revision_count
        }
      })
    );
  }

  /**
   * Create a new data request.
   *
   * @param {string} [teamId] - Optional. If omitted, caller must create a team first and pass its id.
   * @param {number} requestedBy
   * @param {CreateDataRequest} payload
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestRepository
   */
  async createDataRequest(teamId: string, requestedBy: number, payload: CreateDataRequest): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request')
      .insert({
        team_id: teamId,
        requested_by: requestedBy,
        reason: payload.reason
      })
      .returning('*');

    const response = await this.connection.knex(query, DataRequest);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create data request', [
        'DataRequestRepository->createDataRequest',
        'rowCount !== 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing data request.
   *
   * @param {string} dataRequestId
   * @param {UpdateDataRequest} payload
   * @return {Promise<DataRequest>}
   * @memberof DataRequestRepository
   */
  async updateDataRequest(dataRequestId: string, payload: UpdateDataRequest): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date')
      .update(payload)
      .returning('*');

    const response = await this.connection.knex(query, DataRequest);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update data request', [
        'DataRequestRepository->updateDataRequest',
        'rowCount !== 1'
      ]);
    }
    return response.rows[0];
  }

  /**
   * Soft delete a data request by setting the record_end_date.
   *
   * @param {string} dataRequestId
   * @return {Promise<void>}
   * @memberof DataRequestRepository
   */
  async deleteDataRequest(dataRequestId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('data_request')
      .where('data_request_id', dataRequestId)
      .update({ record_end_date: knex.fn.now() });

    const response = await this.connection.knex(query, DataRequest);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete data request', [
        'DataRequestRepository->deleteDataRequest',
        'rowCount !== 1'
      ]);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // data_request_status
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Get all status records for a data request.
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequestStatus[]>}
   * @memberof DataRequestRepository
   */
  async getDataRequestStatuses(dataRequestId: string): Promise<DataRequestStatus[]> {
    const knex = getKnex();
    const query = knex('data_request_status')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date')
      .select('*');

    const response = await this.connection.knex(query, DataRequestStatus);
    return response.rows;
  }

  /**
   * Create a new status record for a data request, optionally with a comment.
   *
   * @param {string} dataRequestId
   * @param {DataRequestStatus} requestStatus
   * @param {string | null} commentId
   * @return {Promise<DataRequestStatus>}
   * @memberof DataRequestRepository
   */
  async createDataRequestStatus(
    dataRequestId: string,
    requestStatus: DataRequestStatusEnum,
    commentId: string | null
  ): Promise<DataRequestStatus> {
    const knex = getKnex();
    const query = knex('data_request_status')
      .insert({
        data_request_id: dataRequestId,
        request_status: requestStatus,
        comment_id: commentId
      })
      .returning('*');

    const response = await this.connection.knex(query, DataRequestStatus);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create data request status', [
        'DataRequestRepository->createDataRequestStatus',
        'rowCount !== 1'
      ]);
    }
    return response.rows[0];
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // comment
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new comment.
   *
   * @param {string} comment
   * @return {Promise<Comment>}
   * @memberof DataRequestRepository
   */
  async createComment(comment: string): Promise<Comment> {
    const knex = getKnex();
    const query = knex('comment').insert({ comment }).returning('*');

    const response = await this.connection.knex(query, Comment);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create comment', [
        'DataRequestRepository->createComment',
        'rowCount !== 1'
      ]);
    }
    return response.rows[0];
  }
}
