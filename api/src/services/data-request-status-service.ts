import { IDBConnection } from '../database/db';
import { DataRequestStatus, DataRequestStatusEnum } from '../models/data-request-status';
import { DataRequestStatusRepository } from '../repositories/data-request-status-repository';
import { DBService } from './db-service';

/**
 * Service for managing data request statuses.
 */
export class DataRequestStatusService extends DBService {
  dataRequestStatusRepository: DataRequestStatusRepository;

  /**
   * Initializes the DataRequestStatusService with a database connection.
   *
   * @param {IDBConnection} connection
   * @memberof DataRequestStatusService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.dataRequestStatusRepository = new DataRequestStatusRepository(connection);
  }

  /**
   * Find a specific data request status by its ID.
   *
   * @param {string} dataRequestStatusId
   * @return {Promise<DataRequestStatus>}
   * @memberof DataRequestStatusService
   */
  async getDataRequestStatusById(dataRequestStatusId: string): Promise<DataRequestStatus> {
    const dataRequestStatus = await this.dataRequestStatusRepository.getDataRequestStatusById(dataRequestStatusId);
    return dataRequestStatus;
  }

  /**
   * Create a new data request status with a default status and an optional comment.
   *
   * @param {string} dataRequestId
   * @param {DataRequestStatusEnum} [requestStatus=DataRequestStatusEnum.enum.REQUESTED]
   * @param {string} [commentId]
   * @return {Promise<DataRequestStatus>}
   * @memberof DataRequestStatusService
   */
  async createDataRequestStatus(
    dataRequestId: string,
    requestStatus: DataRequestStatusEnum = DataRequestStatusEnum.enum.REQUESTED,
    commentId?: string
  ): Promise<DataRequestStatus> {
    const dataRequestStatus = await this.dataRequestStatusRepository.createDataRequestStatus(
      dataRequestId,
      requestStatus,
      commentId ?? null
    );
    return dataRequestStatus;
  }

  /**
   * Update the status of an existing data request status record.
   *
   * @param {string} dataRequestStatusId
   * @param {DataRequestStatusEnum} [requestStatus=DataRequestStatusEnum.enum.REQUESTED]
   * @return {Promise<void>}
   * @memberof DataRequestStatusService
   */
  async updateDataRequestStatus(
    dataRequestStatusId: string,
    requestStatus: DataRequestStatusEnum = DataRequestStatusEnum.enum.REQUESTED
  ): Promise<void> {
    return this.dataRequestStatusRepository.updateDataRequestStatus(dataRequestStatusId, {
      request_status: requestStatus
    });
  }
}
