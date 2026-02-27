import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { DataRequestStatus, DataRequestStatusEnum, UpdateDataRequestStatus } from '../models/data-request-status';
import { BaseRepository } from './base-repository';

/**
 * Data request status repository class.
 *
 * @export
 * @class DataRequestStatusRepository
 * @extends {BaseRepository}
 */
export class DataRequestStatusRepository extends BaseRepository {
  /**
   * Find a specific data request status by its ID.
   *
   * @param {string} dataRequestStatusId
   * @return {Promise<DataRequestStatus>}
   * @memberof DataRequestStatusRepository
   */
  async getDataRequestStatusById(dataRequestStatusId: string): Promise<DataRequestStatus> {
    const knex = getKnex();
    const query = knex('data_request_status')
      .select('data_request_id', 'data_request_status_id', 'comment_id', 'request_status')
      .where('data_request_status_id', dataRequestStatusId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, DataRequestStatus);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Data request status not found', [
        'DataRequestStatusRepository->getDataRequestStatusById',
        { dataRequestStatusId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'DataRequestStatusRepository->getDataRequestStatusById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get the current status record for a data request.
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequestStatus>}
   * @memberof DataRequestStatusRepository
   */
  async getDataRequestStatusByDataRequestId(dataRequestId: string): Promise<DataRequestStatus> {
    const knex = getKnex();
    const query = knex('data_request_status')
      .select('data_request_id', 'data_request_status_id', 'comment_id', 'request_status')
      .where('data_request_id', dataRequestId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, DataRequestStatus);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Data request status not found', [
        'DataRequestStatusRepository->getDataRequestStatusByDataRequestId',
        { dataRequestId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'DataRequestStatusRepository->getDataRequestStatusByDataRequestId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Create a new status record for a data request, optionally with a comment.
   *
   * @param {string} dataRequestId
   * @param {DataRequestStatusEnum} requestStatus
   * @param {string | null} commentId
   * @return {Promise<DataRequestStatus>}
   * @memberof DataRequestStatusRepository
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

  /**
   * Update the status of a data request status record.
   *
   * @param {string} dataRequestStatusId
   * @param {UpdateDataRequestStatus} payload
   * @return {Promise<void>}
   * @memberof DataRequestStatusRepository
   */
  async updateDataRequestStatus(dataRequestStatusId: string, payload: UpdateDataRequestStatus): Promise<void> {
    const knex = getKnex();
    const query = knex('data_request_status')
      .where('data_request_status_id', dataRequestStatusId)
      .whereNull('record_end_date')
      .update(payload)
      .returning(['data_request_id', 'data_request_status_id', 'comment_id', 'request_status']);

    const response = await this.connection.knex(query, DataRequestStatus);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update data request status', [
        'DataRequestStatusRepository->updateDataRequestStatus',
        'rowCount !== 1'
      ]);
    }
  }
}
