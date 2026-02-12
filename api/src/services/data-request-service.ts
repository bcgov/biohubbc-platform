import { IDBConnection } from '../database/db';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestStatusEnum,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { DataRequestFilters, DataRequestRepository } from '../repositories/data-request-repository';
import { TeamMemberService } from './access-policy/team-member-service';
import { DBService } from './db-service';

/**
 * Service interface for models that are associated with a team. Used by authorizeByModelTeamMember to
 * determine if the current user is a member of the team for the given model record.
 *
 * @export
 */
export interface IModelWithTeamMemberService {
  /**
   * Returns the true if the given user is a member of the team associated with the model
   * record identified by modelId; otherwise returns false.
   *
   * @param {string} modelId - The id of the model record (e.g. data request id).
   * @param {number} systemUserId - The system user id to check for team membership.
   * @return {Promise<boolean>}
   */
  isCurrentUserATeamMember(modelId: string, userId: number): Promise<boolean>;
}

type ModelTeamMemberRecord = {
  team_id: string;
};

/**
 * Service for managing data requests.
 */
export class DataRequestService extends DBService implements IModelWithTeamMemberService {
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
   * Returns the team record if the given user is a member of the team associated with the data
   * request; otherwise returns null. Used by authorizeByModelTeamMember.
   *
   * @param {string} dataRequestId - The data request id.
   * @param {number} userId - The system user id to check for team membership.
   * @return {Promise<ModelTeamMemberRecord | null>}
   */
  async findTeamMember(dataRequestId: string, userId: number): Promise<ModelTeamMemberRecord | null> {
    const dataRequest = await this.findDataRequestById(dataRequestId);
    if (!dataRequest) {
      return null;
    }

    const teamMemberService = new TeamMemberService(this.connection);
    const teamMembers = await teamMemberService.getTeamMembers(dataRequest.team_id);
    const isMember = teamMembers.some((member) => member.system_user_id === userId);

    return isMember ? { team_id: dataRequest.team_id } : null;
  }

  /**
   * Checks if the provided user is a member of the team associated with the given data request.
   *
   * @param {string} dataRequestId - The data request id to check.
   * @param {number} userId - The system user id to check for team membership.
   * @returns {Promise<boolean>} - True if the user is a team member, false otherwise.
   */
  async isCurrentUserATeamMember(dataRequestId: string, userId: number): Promise<boolean> {
    const teamMemberRecord = await this.findTeamMember(dataRequestId, userId);
    return teamMemberRecord !== null;
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
