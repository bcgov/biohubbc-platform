import { IDBConnection } from '../database/db';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestFilters,
  DataRequestStatusEnum,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { TeamMember } from '../models/team-member';
import { DataRequestRepository } from '../repositories/data-request-repository';
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
   * @param {string} dataRequestId - The data request id.
   * @param {number} userId - The system user id to check for team membership.
   * @return {Promise<TeamMember | null>}
   */
  async findTeamMember(dataRequestId: string, userId: number): Promise<TeamMember | null> {
    const dataRequest = await this.getDataRequestById(dataRequestId);

    const teamMemberService = new TeamMemberService(this.connection);
    const members = await teamMemberService.getTeamMembers(dataRequest.team_id);

    const member = members.find((member) => member.system_user_id === userId);

    if (!member) {
      return null;
    }

    return member;
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
   * If teamId is undefined, a new team is created first and its id is used for the data request.
   *
   * @param {number} requestedBy
   * @param {CreateDataRequest} payload
   * @param {string} [teamId]
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestService
   */
  async createDataRequest(
    requestedBy: number,
    payload: CreateDataRequest,
    teamId?: string
  ): Promise<DataRequestWithStatus> {
    let resolvedTeamId = teamId;
    if (resolvedTeamId === undefined) {
      const teamService = new TeamService(this.connection);
      // TODO: What should we name this team?
      const team = await teamService.createTeam({ name: 'Data request team' });
      resolvedTeamId = team.team_id;
    }

    const dataRequest = await this.dataRequestRepository.createDataRequest(resolvedTeamId, requestedBy, payload);
    const dataRequestStatus = await this.dataRequestRepository.createDataRequestStatus(
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
