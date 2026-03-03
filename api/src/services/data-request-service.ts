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
import { PolicyEffect } from '../models/policy-statement';
import { Team } from '../models/team';
import { DataRequestRepository } from '../repositories/data-request-repository';
import {
  _generateDataRequestPolicyName,
  _generateDataRequestTeamName,
  _getDataRequestPolicyExpiryDate,
  _transformFlatDataRequestToNested
} from '../utils/data-request';
import { PolicyService } from './access-policy/policy-service';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { DataRequestStatusService } from './data-request-status-service';
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
   * Find all data requests without user scoping, optionally filtered by date range, requested_by, team_id, or status.
   *
   * @param {DataRequestFilters} [filters]
   * @return {Promise<DataRequestWithStatus[]>}
   * @memberof DataRequestService
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<DataRequestWithStatus[]> {
    const dataRequests = await this.dataRequestRepository.findDataRequests(filters);
    return dataRequests.map(_transformFlatDataRequestToNested);
  }

  /**
   * Find all data requests in teams the user is a member of, optionally filtered by date range, requested_by, team_id, or status.
   *
   * @param {number} systemUserId
   * @param {DataRequestFilters} [filters]
   * @return {Promise<DataRequestWithStatus[]>}
   * @memberof DataRequestService
   */
  async findDataRequestsBySystemUserId(
    systemUserId: number,
    filters?: DataRequestFilters
  ): Promise<DataRequestWithStatus[]> {
    const dataRequests = await this.dataRequestRepository.findDataRequestsByTeamMembership(systemUserId, filters);
    return dataRequests.map(_transformFlatDataRequestToNested);
  }

  /**
   * Create a new data request.
   *
   * Creates a team for the requester, a wildcard access policy expiring in 30 days
   * linked to the team, and auto-approves the request.
   *
   * @param {number} requestedBy - system user id
   * @param {CreateDataRequest} payload
   * @return {Promise<DataRequestWithStatus>}
   * @memberof DataRequestService
   */
  async createDataRequest(requestedBy: number, payload: CreateDataRequest): Promise<DataRequestWithStatus> {
    let resolvedTeamId: string;
    if (payload.team_id) {
      resolvedTeamId = payload.team_id;
    } else {
      const team = await this.createAndReturnTeamForDataRequest(requestedBy);
      resolvedTeamId = team.team_id;
    }
    const payloadWithTeamId = { ...payload, team_id: resolvedTeamId };

    const dataRequest = await this.dataRequestRepository.createDataRequest(requestedBy, payloadWithTeamId);

    const policy = await this.createPolicyForDataRequest(dataRequest.data_request_id);
    await this.linkTeamToPolicy(resolvedTeamId, policy.policy_id);

    const dataRequestStatusService = new DataRequestStatusService(this.connection);
    // initially defaults status to APPROVED for development
    const dataRequestStatus = await dataRequestStatusService.createDataRequestStatus(
      dataRequest.data_request_id,
      DataRequestStatusEnum.enum.APPROVED,
      undefined
    );

    return {
      ...dataRequest,
      data_request_status: dataRequestStatus
    };
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

  /**
   * Creates a Team and TeamMember for the system user
   * returns the Team
   *
   * @param {number} requestedBy - system user id
   * @return {Promise<Team>} team to use for the data request
   * @private
   */
  private async createAndReturnTeamForDataRequest(requestedBy: number): Promise<Team> {
    const teamService = new TeamService(this.connection);
    const team = await teamService.createTeam({ name: _generateDataRequestTeamName() });
    const teamMemberService = new TeamMemberService(this.connection);
    await teamMemberService.createTeamMember({ system_user_id: requestedBy, team_id: team.team_id });
    return team;
  }

  /**
   * Creates an access policy for a data request (expires in 30 days).
   *
   * @param {string} dataRequestId
   * @return {Promise<{ policy_id: string }>}
   * @private
   */
  private async createPolicyForDataRequest(dataRequestId: string): Promise<{ policy_id: string }> {
    const policyService = new PolicyService(this.connection);
    return policyService.createPolicyWithStatements(
      {
        name: _generateDataRequestPolicyName(),
        description: `Auto-generated policy for data request ${dataRequestId}`,
        record_end_date: _getDataRequestPolicyExpiryDate()
      },
      [{ effect: PolicyEffect.ALLOW, submission_feature_urn: 'urn:*:*:*' }]
    );
  }

  /**
   * Links a team to a policy by creating a team policy record.
   *
   * @param {string} teamId
   * @param {string} policyId
   * @return {Promise<void>}
   * @private
   */
  private async linkTeamToPolicy(teamId: string, policyId: string): Promise<void> {
    const teamPolicyService = new TeamPolicyService(this.connection);
    await teamPolicyService.createTeamPolicy({ team_id: teamId, policy_id: policyId });
  }
}
