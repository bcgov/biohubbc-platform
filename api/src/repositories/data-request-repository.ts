import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  CreateDataRequest,
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
   * Find all data requests, optionally filtered by date range, requested_by, team_id, or status.
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
        'drs.data_request_status_id',
        'drs.comment_id',
        'drs.request_status'
      )
      .join('data_request_status as drs', 'drs.data_request_id', 'dr.data_request_id')
      .whereNull('dr.record_end_date')
      .whereNull('drs.record_end_date');

    if (filters?.status) {
      queryBuilder.where('drs.request_status', filters.status);
    }
    if (filters?.date_from) {
      queryBuilder.where('dr.create_date', '>=', filters.date_from);
    }
    if (filters?.date_to) {
      queryBuilder.where('dr.create_date', '<=', filters.date_to);
    }
    if (filters?.requested_by) {
      queryBuilder.where('dr.requested_by', filters.requested_by);
    }
    if (filters?.team_id) {
      queryBuilder.where('dr.team_id', filters.team_id);
    }

    const response = await this.connection.knex(queryBuilder, FlatDataRequestWithStatus);
    return response.rows;
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
        'drs.data_request_status_id',
        'drs.comment_id',
        'drs.request_status'
      )
      .join('data_request_status as drs', 'drs.data_request_id', 'dr.data_request_id')
      .where('dr.data_request_id', dataRequestId)
      .whereNull('dr.record_end_date')
      .whereNull('drs.record_end_date');

    const response = await this.connection.knex(query, FlatDataRequestWithStatus);

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
   * @param {CreateDataRequest} payload
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestRepository
   */
  async createDataRequest(requestedBy: number, payload: CreateDataRequest): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request')
      .insert({
        requested_by: requestedBy,
        team_id: payload.team_id,
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
}
