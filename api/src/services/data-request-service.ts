import { IDBConnection } from '../database/db';
import { HTTP404 } from '../errors/http-error';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestFilters,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { DataRequestStatusEnum } from '../models/data-request-status';
import { TeamMember } from '../models/team-member';
import { TeamMemberRepository } from '../repositories/authorization/team-member-repository';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { DataRequestStatusRepository } from '../repositories/data-request-status-repository';
import { _generateDataRequestTeamName, _transformFlatDataRequestToNested } from '../utils/data-request';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamService } from './access-policy/team-service';
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
   * Returns the team_member record if the given user is a member of the team associated with the data
   * request; otherwise returns null.
   *
   * @param {string} teamId - The team id.
   * @param {number} userId - The system user id to check for team membership.
   * @return {Promise<TeamMember | null>}
   */
  async findTeamMember(teamId: string, userId: number): Promise<TeamMember | null> {
    const teamMemberService = new TeamMemberService(this.connection);
    const members = await teamMemberService.getTeamMembers(teamId);

    const member = members.find((member) => member.system_user_id === userId);

    if (!member) {
      return null;
    }

    return member;
  }

  /**
   * Returns a specific data_request by its ID without an authorization check
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
   *
   * @param {DataRequestFilters} [filters]
   * @return {Promise<DataRequest[]>}
   * @memberof DataRequestService
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<DataRequestWithStatus[]> {
    const dataRequests = await this.dataRequestRepository.findDataRequests(filters);

    return dataRequests.map(_transformFlatDataRequestToNested);
  }

  /**
   * Create a new data request.
   * If teamId is undefined, a new team is created first and its id is used for the data request.
   *
   * @param {number} requestedBy - system user id
   * @param {CreateDataRequest} payload
   * @param {string} [teamId]
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestService
   */
  async createDataRequest(requestedBy: number, payload: CreateDataRequest): Promise<DataRequestWithStatus> {
    let resolvedTeamId = payload.team_id;
    if (resolvedTeamId === undefined) {
      const teamService = new TeamService(this.connection);
      const team = await teamService.createTeam({ name: _generateDataRequestTeamName() });
      resolvedTeamId = team.team_id;

      const teamMemberService = new TeamMemberRepository(this.connection);
      await teamMemberService.insertTeamMember({ system_user_id: requestedBy, team_id: resolvedTeamId });
    }

    const payloadWithTeamId = { ...payload, team_id: resolvedTeamId };

    const dataRequest = await this.dataRequestRepository.createDataRequest(requestedBy, payloadWithTeamId);

    const dataRequestStatusRepository = new DataRequestStatusRepository(this.connection);
    const dataRequestStatus = await dataRequestStatusRepository.createDataRequestStatus(
      dataRequest.data_request_id,
      DataRequestStatusEnum.enum.REQUESTED,
      null
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
   * @return {Promise<DataRequest>}
   * @memberof DataRequestRepository
   */
  async updateDataRequest(dataRequestId: string, payload: UpdateDataRequest): Promise<DataRequest> {
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);

    if (!dataRequest) {
      throw new HTTP404('Data request not found');
    }

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
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);

    if (!dataRequest) {
      throw new HTTP404('Data request not found');
    }

    return this.dataRequestRepository.deleteDataRequest(dataRequestId);
  }
}
