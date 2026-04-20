import { IDBConnection } from '../database/db';
import {
  CreateDataRequest,
  CreateDataRequestPayload,
  DataRequest,
  DataRequestFilters,
  UpdateDataRequest
} from '../models/data-request';
import { PolicyEffect } from '../models/policy-statement';
import { Team } from '../models/team';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { _generateDataRequestPolicyName, _generateDataRequestTeamName } from '../utils/data-request';
import { PolicyService } from './access-policy/policy-service';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { DBService } from './db-service';
import { TicketService } from './ticket-service';

/**
 * Service for data-request operations and request-scoped team/policy creation.
 *
 * @export
 * @class DataRequestService
 * @extends {DBService}
 */
export class DataRequestService extends DBService {
  dataRequestRepository: DataRequestRepository;
  policyService: PolicyService;
  teamService: TeamService;
  teamPolicyService: TeamPolicyService;
  teamMemberService: TeamMemberService;

  /**
   * Creates an instance of DataRequestService.
   *
   * @param {IDBConnection} connection - Database connection object.
   * @memberof DataRequestService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.dataRequestRepository = new DataRequestRepository(connection);
    this.policyService = new PolicyService(connection);
    this.teamService = new TeamService(connection);
    this.teamPolicyService = new TeamPolicyService(connection);
    this.teamMemberService = new TeamMemberService(connection);
  }

  /**
   * Find a data request by ID.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<(DataRequest | null)>} Data request or null.
   * @memberof DataRequestService
   */
  async findDataRequestById(dataRequestId: string): Promise<DataRequest | null> {
    return this.dataRequestRepository.findDataRequestById(dataRequestId);
  }

  /**
   * Get a data request by ID.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<DataRequest>} Data request record.
   * @memberof DataRequestService
   */
  async getDataRequestById(dataRequestId: string): Promise<DataRequest> {
    return this.dataRequestRepository.getDataRequestById(dataRequestId);
  }

  /**
   * Find data requests with optional filters.
   *
   * @param {DataRequestFilters} [filters] - Optional query filters.
   * @return {Promise<DataRequest[]>} Matching data requests.
   * @memberof DataRequestService
   */
  async findDataRequests(filters?: DataRequestFilters): Promise<DataRequest[]> {
    return this.dataRequestRepository.findDataRequests(filters);
  }

  /**
   * Find data requests visible to one or more system users via team membership.
   *
   * @param {number[]} systemUserIds - System user identifiers.
   * @param {DataRequestFilters} [filters] - Optional query filters.
   * @return {Promise<DataRequest[]>} Matching data requests.
   * @memberof DataRequestService
   */
  async findDataRequestsByTeamMembership(
    systemUserIds: number[],
    filters?: DataRequestFilters
  ): Promise<DataRequest[]> {
    return this.dataRequestRepository.findDataRequestsByTeamMembership(systemUserIds, filters);
  }

  /**
   * Find data requests for a ticket.
   *
   * @param {string} ticketId - Ticket UUID.
   * @return {Promise<DataRequest[]>} Matching data requests.
   * @memberof DataRequestService
   */
  async findDataRequestsByTicketId(ticketId: string): Promise<DataRequest[]> {
    return this.dataRequestRepository.findDataRequestsByTicketId(ticketId);
  }

  /**
   * Create a data request by first creating a new ticket.
   *
   * @param {CreateDataRequestPayload} payload - Create payload.
   * @return {Promise<DataRequest>} Created data request.
   * @memberof DataRequestService
   */
  async createDataRequest(payload: CreateDataRequestPayload): Promise<DataRequest> {
    const ticketService = new TicketService(this.connection);
    const ticket = await ticketService.createTicket({
      subject: this._generateTicketSubject(payload.reason),
      description: payload.reason,
      priority: 'medium'
    });

    return this.createDataRequestForTicket(ticket.ticket_id, payload);
  }

  /**
   * Create a data request for an existing ticket.
   *
   * @param {string} ticketId - Existing ticket id.
   * @param {CreateDataRequestPayload} payload - Ticket-owned create payload.
   * @return {Promise<DataRequest>} Created data request.
   * @memberof DataRequestService
   */
  async createDataRequestForTicket(ticketId: string, payload: CreateDataRequestPayload): Promise<DataRequest> {
    const [dataRequestTeam, policyTeam] = await Promise.all([
      this._createTeamWithMembers(payload.system_user_ids),
      this._createTeamWithMembers(payload.system_user_ids)
    ]);

    const policy = await this.policyService.createPolicyWithStatements(
      {
        name: _generateDataRequestPolicyName(),
        description: 'Auto-generated policy for ticket-linked data request',
        status: 'requested'
      },
      [{ effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:*:*' }]
    );
    await this.teamPolicyService.createTeamPolicy({
      team_id: policyTeam.team_id,
      policy_id: policy.policy_id
    });

    const payloadWithIds: CreateDataRequest = {
      requested_by: payload.requested_by,
      reason: payload.reason,
      team_id: dataRequestTeam.team_id,
      ticket_id: ticketId,
      policy_id: policy.policy_id
    };

    const dataRequest = await this.dataRequestRepository.createDataRequest(payloadWithIds);

    return this.getDataRequestById(dataRequest.data_request_id);
  }

  /**
   * Update mutable data-request fields.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @param {UpdateDataRequest} payload - Update payload.
   * @return {Promise<void>}
   * @memberof DataRequestService
   */
  async updateDataRequest(dataRequestId: string, payload: UpdateDataRequest): Promise<void> {
    return this.dataRequestRepository.updateDataRequest(dataRequestId, payload);
  }

  /**
   * Soft delete a data request.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<void>}
   * @memberof DataRequestService
   */
  async deleteDataRequest(dataRequestId: string): Promise<void> {
    await this.dataRequestRepository.deleteDataRequest(dataRequestId);
  }

  /**
   * Generate a stable subject for auto-created data request tickets.
   *
   * @private
   * @param {string} reason - Request reason.
   * @return {string} Ticket subject.
   * @memberof DataRequestService
   */
  private _generateTicketSubject(reason: string): string {
    const trimmed = reason.trim();
    if (!trimmed) {
      return 'Data Request';
    }

    const excerpt = trimmed.split(/\s+/).slice(0, 10).join(' ');
    return `Data Request - ${excerpt}`;
  }

  /**
   * Create a request-scoped team and populate it with provided members.
   *
   * @private
   * @param {number[]} systemUserIds - Team member system user identifiers.
   * @return {Promise<Team>} Created team.
   * @memberof DataRequestService
   */
  private async _createTeamWithMembers(systemUserIds: number[]): Promise<Team> {
    const team = await this.teamService.createTeam({ name: _generateDataRequestTeamName() });
    const uniqueMemberIds = Array.from(new Set(systemUserIds));

    await Promise.all(
      uniqueMemberIds.map((systemUserId) =>
        this.teamMemberService.createTeamMember({ system_user_id: systemUserId, team_id: team.team_id })
      )
    );

    return team;
  }
}
