import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateDataRequestPayload,
  DataRequest,
  DataRequestFilters,
  FlatDataRequestWithStatus,
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
   * Find all data requests without user scoping, optionally filtered by date range, requested_by, team_id, or status.
   *
   * @param {DataRequestFilters} [filters] - Optional filters (date_from, date_to, requested_by, team_id, status).
   * @return {Promise<FlatDataRequestWithStatus[]>}
   * @memberof DataRequestRepository
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<FlatDataRequestWithStatus[]> {
    const knex = getKnex();
    const queryBuilder = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'drs.data_request_status_id',
        'drs.comment_id',
        'drs.request_status'
      )
      .join('data_request_status as drs', 'drs.data_request_id', 'dr.data_request_id')
      .whereNull('dr.record_end_date')
      .whereNull('drs.record_end_date');

    this.applyFilters(queryBuilder, filters);
    const response = await this.connection.knex(queryBuilder, FlatDataRequestWithStatus);
    return response.rows;
  }

  /**
   * Find all data requests in teams the user is a member of, optionally filtered by date range, requested_by, team_id, or status.
   *
   * @param {number} systemUserId - The system user ID to scope results by team membership.
   * @param {DataRequestFilters} [filters] - Optional filters (date_from, date_to, requested_by, team_id, status).
   * @return {Promise<FlatDataRequestWithStatus[]>}
   * @memberof DataRequestRepository
   */
  async findDataRequestsByTeamMembership(
    systemUserId: number,
    filters?: DataRequestFilters
  ): Promise<FlatDataRequestWithStatus[]> {
    const knex = getKnex();
    const queryBuilder = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'drs.data_request_status_id',
        'drs.comment_id',
        'drs.request_status'
      )
      .join('data_request_status as drs', 'drs.data_request_id', 'dr.data_request_id')
      .join('team_member as tm', 'tm.team_id', 'dr.team_id')
      .where('tm.system_user_id', systemUserId)
      .whereNull('dr.record_end_date')
      .whereNull('drs.record_end_date')
      .whereNull('tm.record_end_date');

    this.applyFilters(queryBuilder, filters);
    const response = await this.connection.knex(queryBuilder, FlatDataRequestWithStatus);
    return response.rows;
  }

  /**
   * Apply data request list filters to the provided query.
   *
   * @param {Knex.QueryBuilder} query - Base query to filter.
   * @param {DataRequestFilters} [filters] - Optional filter set.
   * @return {Knex.QueryBuilder} Filtered query.
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: DataRequestFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.status) {
      query.where('drs.request_status', filters.status);
    }
    if (filters.date_from) {
      query.where('dr.create_date', '>=', filters.date_from);
    }
    if (filters.date_to) {
      query.where('dr.create_date', '<=', filters.date_to);
    }
    if (filters.requested_by) {
      query.where('dr.requested_by', filters.requested_by);
    }
    if (filters.team_id) {
      query.where('dr.team_id', filters.team_id);
    }

    return query;
  }

  /**
   * Get a specific data request by its ID. Throws an error if the data request does not exist.
   *
   * @param {string} dataRequestId
   * @return {Promise<FlatDataRequestWithStatus>}
   * @memberof DataRequestRepository
   */
  async getDataRequestById(dataRequestId: string): Promise<FlatDataRequestWithStatus> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'drs.data_request_status_id',
        'drs.comment_id',
        'drs.request_status'
      )
      .join('data_request_status as drs', 'drs.data_request_id', 'dr.data_request_id')
      .where('dr.data_request_id', dataRequestId)
      .whereNull('dr.record_end_date')
      .whereNull('drs.record_end_date');

    const response = await this.connection.knex(query, FlatDataRequestWithStatus);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Data request not found', [
        'DataRequestRepository->getDataRequestById',
        { dataRequestId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'DataRequestRepository->getDataRequestById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find a specific data request by its ID.
   *
   * @param {string} dataRequestId
   * @return {Promise<FlatDataRequestWithStatus | null>}
   * @memberof DataRequestRepository
   */
  async findDataRequestById(dataRequestId: string): Promise<FlatDataRequestWithStatus | null> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'drs.data_request_status_id',
        'drs.comment_id',
        'drs.request_status'
      )
      .join('data_request_status as drs', 'drs.data_request_id', 'dr.data_request_id')
      .where('dr.data_request_id', dataRequestId)
      .whereNull('dr.record_end_date')
      .whereNull('drs.record_end_date');

    const response = await this.connection.knex(query, FlatDataRequestWithStatus);
    return response.rows[0] ?? null;
  }

  /**
   * Create a new data request.
   *
   * @param {number} requestedBy
   * @param {CreateDataRequestPayload} payload
   * @return {Promise<DataRequest>}
   * @memberof DataRequestRepository
   */
  async createDataRequest(requestedBy: number, payload: CreateDataRequestPayload): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request')
      .insert({
        requested_by: requestedBy,
        team_id: payload.team_id,
        reason: payload.reason,
        ticket_id: payload.ticket_id
      })
      .returning(['requested_by', 'team_id', 'data_request_id', 'reason', 'ticket_id']);

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
   * @return {Promise<void>}
   * @memberof DataRequestRepository
   */
  async updateDataRequest(dataRequestId: string, payload: UpdateDataRequest): Promise<void> {
    const knex = getKnex();
    const query = knex('data_request')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date')
      .update(payload)
      .returning(['data_request_id', 'reason', 'requested_by', 'team_id', 'ticket_id']);

    const response = await this.connection.knex(query, DataRequest);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update data request', [
        'DataRequestRepository->updateDataRequest',
        'rowCount !== 1'
      ]);
    }
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
}
