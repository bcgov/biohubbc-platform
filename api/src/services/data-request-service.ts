import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { HTTP404 } from '../errors/http-error';
import {
  CreateDataRequest,
  DataRequestFilters,
  DataRequestWithStatus,
  FlatDataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { DataRequestStatusEnum } from '../models/data-request-status';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { _generateDataRequestTeamName, _transformFlatDataRequestToNested } from '../utils/data-request';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamService } from './access-policy/team-service';
import { DataRequestStatusService } from './data-request-status-service';
import { DBService } from './db-service';
import { UserService } from './user-service';

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
   * Returns a specific data_request by its ID without an authorization check
   *
   * @param {string} dataRequestId
   * @return {Promise<FlatDataRequestWithStatus | null>}
   * @memberof DataRequestService
   */
  async findDataRequestById(dataRequestId: string): Promise<FlatDataRequestWithStatus | null> {
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);
    return dataRequest;
  }

  /**
   * Returns a specific data_request and user must be authorized
   *
   * @param {string} dataRequestId
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestService
   */
  async getDataRequestById(dataRequestId: string): Promise<DataRequestWithStatus> {
    const dataRequest = await this.dataRequestRepository.getDataRequestById(dataRequestId);

    return _transformFlatDataRequestToNested(dataRequest);
  }

  /**
   * Find all data requests, optionally filtered by date range, requested_by, team_id, or status.
   * For non-SYSTEM_ADMIN users, results are scoped to data requests in teams the user is a member of.
   *
   * @param {DataRequestFilters} [filters]
   * @return {Promise<DataRequestWithStatus[]>}
   * @memberof DataRequestService
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<DataRequestWithStatus[]> {
    const systemUserId = this.connection.systemUserId();
    const userService = new UserService(this.connection);
    const user = await userService.getUserById(systemUserId);

    const isSystemAdmin = user.role_names.includes(SYSTEM_ROLE.SYSTEM_ADMIN);

    if (isSystemAdmin) {
      const dataRequests = await this.dataRequestRepository.findDataRequests(filters);
      return dataRequests.map(_transformFlatDataRequestToNested);
    }

    const dataRequests = await this.dataRequestRepository.findDataRequests(filters, systemUserId);
    return dataRequests.map(_transformFlatDataRequestToNested);
  }

  /**
   * Create a new data request.
   * If teamId is undefined, a new team is created first and its id is used for the data request.
   *
   * @param {number} requestedBy - system user id
   * @param {CreateDataRequest} payload
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestService
   */
  async createDataRequest(requestedBy: number, payload: CreateDataRequest): Promise<DataRequestWithStatus> {
    let resolvedTeamId = payload.team_id;
    if (resolvedTeamId === undefined) {
      const teamService = new TeamService(this.connection);
      const team = await teamService.createTeam({ name: _generateDataRequestTeamName() });
      resolvedTeamId = team.team_id;

      const teamMemberService = new TeamMemberService(this.connection);
      await teamMemberService.createTeamMember({ system_user_id: requestedBy, team_id: resolvedTeamId });
    }

    const payloadWithTeamId = { ...payload, team_id: resolvedTeamId };

    const dataRequest = await this.dataRequestRepository.createDataRequest(requestedBy, payloadWithTeamId);

    const dataRequestStatusService = new DataRequestStatusService(this.connection);
    const dataRequestStatus = await dataRequestStatusService.createDataRequestStatus(
      dataRequest.data_request_id,
      DataRequestStatusEnum.enum.REQUESTED,
      undefined
    );

    const response = {
      ...dataRequest,
      data_request_status: dataRequestStatus
    };

    return response;
  }

  /**
   * Update an existing data request.
   *
   * @param {string} dataRequestId
   * @param {UpdateDataRequest} payload
   * @return {Promise<void>}
   * @memberof DataRequestService
   */
  async updateDataRequest(dataRequestId: string, payload: UpdateDataRequest): Promise<void> {
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);

    if (!dataRequest) {
      throw new HTTP404('Data request not found');
    }

    return await this.dataRequestRepository.updateDataRequest(dataRequestId, payload);
  }

  /**
   * Soft delete a data request by setting the record_end_date.
   *
   * @param {string} dataRequestId
   * @return {Promise<void>}
   * @memberof DataRequestService
   */
  async deleteDataRequest(dataRequestId: string): Promise<void> {
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);

    if (!dataRequest) {
      throw new HTTP404('Data request not found');
    }

    return this.dataRequestRepository.deleteDataRequest(dataRequestId);
  }
}
