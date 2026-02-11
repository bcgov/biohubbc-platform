import { IDBConnection } from '../database/db';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestStatusEnum,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { DataRequestFilters, DataRequestRepository } from '../repositories/data-request-repository';
import { DBService } from './db-service';

/**
 * Service for managing data requests.
 */
export class DataRequestService extends DBService {
  dataRequestRepository: DataRequestRepository;

  /**
   * Initializes the DataRequestService with a database connection.
   *
   * @param {IDBConnection} connection
   * @memberof DataRequestService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.dataRequestRepository = new DataRequestRepository(connection);
  }

  /**
   * Returns a specific data_request by its ID
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequest | null>}
   * @memberof DataRequestService
   */
  async findDataRequestById(dataRequestId: string): Promise<DataRequest | null> {
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);
    return dataRequest;
  }

  /**
   * Returns a specific data_request by its ID
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequest>}
   * @memberof DataRequestService
   */
  async getDataRequestById(dataRequestId: string): Promise<DataRequest> {
    const dataRequest = await this.dataRequestRepository.getDataRequestById(dataRequestId);
    return dataRequest;
  }

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
    return this.dataRequestRepository.findDataRequests(filters);
  }

  /**
   * Find all data requests, optionally by status (will default to REQUESTED).
   *
   * @param {string} [status]
   * @return {Promise<DataRequestWithStatus[]>}
   * @memberof DataRequestRepository
   */
  async findDataRequestsByStatus({
    status,
    filters
  }: {
    status: DataRequestStatusEnum;
    filters?: DataRequestFilters;
  }): Promise<DataRequest[]> {
    return this.dataRequestRepository.findDataRequestsByStatus({ status, filters });
  }

  /**
   * Create a new data request.
   *
   * @param {string} teamId
   * @param {number} requestedBy
   * @param {CreateDataRequest} payload
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestRepository
   */
  async createDataRequest(
    teamId: string,
    requestedBy: number,
    payload: CreateDataRequest
  ): Promise<DataRequestWithStatus> {
    return this.dataRequestRepository.createDataRequest(teamId, requestedBy, payload);
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
    return this.dataRequestRepository.updateDataRequest(dataRequestId, payload);
  }

  /**
   * Soft delete a data request by setting the record_end_date.
   *
   * @param {string} dataRequestId
   * @return {Promise<void>}
   * @memberof DataRequestRepository
   */
  async deleteDataRequest(dataRequestId: string): Promise<void> {
    return this.dataRequestRepository.deleteDataRequest(dataRequestId);
  }
}
