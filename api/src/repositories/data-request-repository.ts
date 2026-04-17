import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreateDataRequest, DataRequest, DataRequestFilters, UpdateDataRequest } from '../models/data-request';
import { BaseRepository } from './base-repository';

/**
 * Repository for `data_request` table operations.
 *
 * @export
 * @class DataRequestRepository
 * @extends {BaseRepository}
 */
export class DataRequestRepository extends BaseRepository {
  /**
   * Find data requests with optional filters.
   *
   * @param {DataRequestFilters} [filters] - Optional query filters.
   * @return {Promise<DataRequest[]>} Matching data requests.
   * @memberof DataRequestRepository
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<DataRequest[]> {
    const knex = getKnex();
    const queryBuilder = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'dr.policy_id',
        'p.status as status',
        'dr.create_date as create_date'
      )
      .join('policy as p', 'p.policy_id', 'dr.policy_id')
      .whereNull('dr.record_end_date')
      .whereNull('p.record_end_date');

    this.applyFilters(queryBuilder, filters);
    const response = await this.connection.knex(queryBuilder, DataRequest);
    return response.rows;
  }

  /**
   * Find data requests scoped to teams that include any of the specified system users.
   *
   * @param {number[]} systemUserIds - System user identifiers.
   * @param {DataRequestFilters} [filters] - Optional query filters.
   * @return {Promise<DataRequest[]>} Matching data requests.
   * @memberof DataRequestRepository
   */
  async findDataRequestsByTeamMembership(
    systemUserIds: number[],
    filters?: DataRequestFilters
  ): Promise<DataRequest[]> {
    if (systemUserIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const queryBuilder = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'dr.policy_id',
        'p.status as status',
        'dr.create_date as create_date'
      )
      .join('policy as p', 'p.policy_id', 'dr.policy_id')
      .join('team_member as tm', 'tm.team_id', 'dr.team_id')
      .whereIn('tm.system_user_id', systemUserIds)
      .whereNull('dr.record_end_date')
      .whereNull('p.record_end_date')
      .whereNull('tm.record_end_date');

    this.applyFilters(queryBuilder, filters);
    const response = await this.connection.knex(queryBuilder, DataRequest);
    return response.rows;
  }

  /**
   * Apply request list filters to a query builder.
   *
   * @private
   * @param {Knex.QueryBuilder} query - Base query.
   * @param {DataRequestFilters} [filters] - Optional filters.
   * @return {Knex.QueryBuilder} Filtered query.
   * @memberof DataRequestRepository
   */
  private applyFilters(query: Knex.QueryBuilder, filters?: DataRequestFilters): Knex.QueryBuilder {
    if (!filters) {
      return query;
    }

    if (filters.status) {
      query.where('p.status', filters.status);
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
   * Get a data request by ID.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<DataRequest>} Matching data request.
   * @memberof DataRequestRepository
   */
  async getDataRequestById(dataRequestId: string): Promise<DataRequest> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'dr.policy_id',
        'p.status as status',
        'dr.create_date as create_date'
      )
      .join('policy as p', 'p.policy_id', 'dr.policy_id')
      .where('dr.data_request_id', dataRequestId)
      .whereNull('dr.record_end_date')
      .whereNull('p.record_end_date');

    const response = await this.connection.knex(query, DataRequest);

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
   * Find a data request by ID and return null when not found.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<(DataRequest | null)>} Matching data request or null.
   * @memberof DataRequestRepository
   */
  async findDataRequestById(dataRequestId: string): Promise<DataRequest | null> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'dr.policy_id',
        'p.status as status',
        'dr.create_date as create_date'
      )
      .join('policy as p', 'p.policy_id', 'dr.policy_id')
      .where('dr.data_request_id', dataRequestId)
      .whereNull('dr.record_end_date')
      .whereNull('p.record_end_date');

    const response = await this.connection.knex(query, DataRequest);
    return response.rows[0] ?? null;
  }

  /**
   * Find a data request by linked policy ID and return null when not found.
   *
   * @param {string} policyId - Policy UUID.
   * @return {Promise<(DataRequest | null)>} Matching data request or null.
   * @memberof DataRequestRepository
   */
  async findDataRequestByPolicy(policyId: string): Promise<DataRequest | null> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'dr.policy_id',
        'p.status as status',
        'dr.create_date as create_date'
      )
      .join('policy as p', 'p.policy_id', 'dr.policy_id')
      .where('dr.policy_id', policyId)
      .whereNull('dr.record_end_date')
      .whereNull('p.record_end_date');

    const response = await this.connection.knex(query, DataRequest);
    return response.rows[0] ?? null;
  }

  /**
   * Create a data request row.
   *
   * @param {CreateDataRequest} payload - Insert payload.
   * @return {Promise<DataRequest>} Created data request.
   * @memberof DataRequestRepository
   */
  async createDataRequest(payload: CreateDataRequest): Promise<DataRequest> {
    const query = SQL`
      WITH inserted_data_request AS (
        INSERT INTO data_request (requested_by, team_id, reason, ticket_id, policy_id)
        VALUES (${payload.requested_by}, ${payload.team_id}, ${payload.reason}, ${payload.ticket_id}, ${payload.policy_id})
        RETURNING requested_by, team_id, data_request_id, reason, ticket_id, policy_id, create_date
      )
      SELECT
        dr.requested_by,
        dr.team_id,
        dr.data_request_id,
        dr.reason,
        dr.ticket_id,
        dr.policy_id,
        p.status AS status,
        dr.create_date AS create_date
      FROM inserted_data_request dr
      JOIN policy p ON p.policy_id = dr.policy_id
      WHERE p.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(query, DataRequest);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to create data request', [
        'DataRequestRepository->createDataRequest',
        'rowCount !== 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update mutable data request fields.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @param {UpdateDataRequest} payload - Update payload.
   * @return {Promise<void>}
   * @memberof DataRequestRepository
   */
  async updateDataRequest(dataRequestId: string, payload: UpdateDataRequest): Promise<void> {
    const knex = getKnex();
    const query = knex('data_request')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date')
      .update(payload)
      .returning(['data_request_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update data request', [
        'DataRequestRepository->updateDataRequest',
        'rowCount !== 1'
      ]);
    }
  }

  /**
   * Soft delete a data request.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<void>}
   * @memberof DataRequestRepository
   */
  async deleteDataRequest(dataRequestId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('data_request')
      .where('data_request_id', dataRequestId)
      .update({ record_end_date: knex.fn.now() });

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete data request', [
        'DataRequestRepository->deleteDataRequest',
        'rowCount !== 1'
      ]);
    }
  }

  /**
   * Find data requests associated with a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<DataRequest[]>} Matching data requests.
   * @memberof DataRequestRepository
   */
  async findDataRequestsByTicketId(ticketId: string): Promise<DataRequest[]> {
    const knex = getKnex();
    const query = knex('data_request as dr')
      .select(
        'dr.data_request_id',
        'dr.team_id',
        'dr.reason',
        'dr.requested_by',
        'dr.ticket_id',
        'dr.policy_id',
        'p.status as status',
        'dr.create_date as create_date'
      )
      .join('policy as p', 'p.policy_id', 'dr.policy_id')
      .where('dr.ticket_id', ticketId)
      .whereNull('dr.record_end_date')
      .whereNull('p.record_end_date')
      .orderBy('dr.create_date', 'asc');

    const response = await this.connection.knex(query, DataRequest);
    return response.rows;
  }
}
