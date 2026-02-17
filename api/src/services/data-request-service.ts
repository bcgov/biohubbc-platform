import { v4 as uuidv4 } from 'uuid';
import { IDBConnection } from '../database/db';
import { HTTP401 } from '../errors/http-error';
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
   * @return {Promise<DataRequest>}
   * @memberof DataRequestService
   */
  async getDataRequestById(dataRequestId: string): Promise<DataRequest> {
    const dataRequest = await this.dataRequestRepository.getDataRequestById(dataRequestId);

    const authorized = await this._authorizeAccessForDataRequest(dataRequest.team_id);

    if (!authorized) {
      throw new HTTP401('Access Denied');
    }

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
    const dataRequests = await this.dataRequestRepository.findDataRequests(filters);

    const allAuthorized = await Promise.all(
      dataRequests.map((dr) => this._authorizeAccessForDataRequest(dr.data_request_id))
    ).then((results) => results.every(Boolean));

    if (!allAuthorized) {
      throw new HTTP401('Access Denied');
    }

    return dataRequests;
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
      const team = await teamService.createTeam({ name: _generateDataRequestTeamName() });
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
    const dataRequest = await this.dataRequestRepository.findDataRequestById(dataRequestId);
    const authorized = await this._authorizeAccessForDataRequest(dataRequest.team_id);

    if (!authorized) {
      throw new HTTP401('Access Denied');
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
    const authorized = await this._authorizeAccessForDataRequest(dataRequest.team_id);

    if (!authorized) {
      throw new HTTP401('Access Denied');
    }

    return this.dataRequestRepository.deleteDataRequest(dataRequestId);
  }

  /**
   * Returns true if the current user may act on this data request (system admin or team member); otherwise false.
   *
   * @param teamId
   */
  async _authorizeAccessForDataRequest(teamId: string): Promise<boolean> {
    const userService = new UserService(this.connection);
    const isSystemAdmin = await userService.isSystemUserAdmin();
    if (isSystemAdmin) {
      return true;
    }

    const userId = this.connection.systemUserId();
    const dataRequestTeamMember = await this.findTeamMember(teamId, userId);

    return dataRequestTeamMember !== null;
  }
}

/**
 * Generates a unique team name for auto-created data request teams.
 *
 * @returns {string} A unique team name.
 */
function _generateDataRequestTeamName(): string {
  return `Data request team - ${uuidv4()}`;
}
