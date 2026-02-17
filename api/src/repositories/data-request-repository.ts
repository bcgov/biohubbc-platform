import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  Comment,
  CreateDataRequest,
  DataRequest,
  DataRequestFilters,
  DataRequestStatus,
  DataRequestStatusEnum,
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
   * Find all data requests, optionally filtered by date range, requested_by, team_id, or status.
   *
   * @param {DataRequestFilters} [filters] - Optional filters (date_from, date_to, requested_by, team_id, status).
   * @return {Promise<DataRequest[]>}
   * @memberof DataRequestRepository
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<DataRequest[]> {
    const knex = getKnex();

    if (filters?.status) {
      const query = knex('data_request as dr')
        .select('dr.requested_by', 'dr.team_id', 'dr.data_request_id', 'dr.reason')
        .join('data_request_status as drs', function () {
          this.on('dr.data_request_id', '=', 'drs.data_request_id').onNull('drs.record_end_date');
        })
        .where('drs.request_status', filters.status)
        .whereNull('dr.record_end_date');

      if (filters?.date_from) {
        query.where('dr.create_date', '>=', filters.date_from);
      }
      if (filters?.date_to) {
        query.where('dr.create_date', '<=', filters.date_to);
      }
      if (filters?.requested_by) {
        query.where('dr.requested_by', filters.requested_by);
      }
      if (filters?.team_id) {
        query.where('dr.team_id', filters.team_id);
      }

      const response = await this.connection.knex(query, DataRequest);
      return response.rows;
    }

    const query = knex('data_request')
      .select('requested_by', 'team_id', 'data_request_id', 'reason')
      .whereNull('record_end_date');

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
    const query = knex('data_request')
      .select('requested_by', 'team_id', 'data_request_id', 'reason')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date');

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
  async findDataRequestById(dataRequestId: string): Promise<DataRequest | null> {
    const knex = getKnex();
    const query = knex('data_request')
      .select('requested_by', 'team_id', 'data_request_id', 'reason')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, DataRequest);

    return response.rows[0] ?? null;
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
      .returning(['requested_by', 'team_id', 'data_request_id', 'reason']);

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
      .returning(['data_request_id', 'reason', 'requested_by', 'team_id']);

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
      .select('data_request_id', 'data_request_status_id', 'comment_id', 'request_status')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date');

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
      .returning(['data_request_id', 'data_request_status_id', 'comment_id', 'request_status']);

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
    const query = knex('comment').insert({ comment }).returning(['comment', 'comment_id']);

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
