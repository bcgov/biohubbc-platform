import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import { CreateDataRequestPayload, DataRequest, DataRequestFilters, UpdateDataRequest } from '../models/data-request';
import { CreatePolicyStatementPayload, PolicyEffect } from '../models/policy-statement';
import { Team } from '../models/team';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { FeatureIngestionRepository } from '../repositories/ingestion/feature-ingestion-repository';
import { _generateDataRequestPolicyName, _generateDataRequestTeamName } from '../utils/data-request';
import { PolicyExpressionService } from './access-policy/policy-expression-service';
import { PolicyService } from './access-policy/policy-service';
import { PolicyStatementService } from './access-policy/policy-statement-service';
import { TeamMemberService } from './access-policy/team-member-service';
import { TeamPolicyService } from './access-policy/team-policy-service';
import { TeamService } from './access-policy/team-service';
import { DBService } from './db-service';
import { ExpressionTreeService } from './expression-tree-service';
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
  expressionTreeService: ExpressionTreeService;
  policyStatementService: PolicyStatementService;
  policyExpressionService: PolicyExpressionService;
  featureIngestionRepository: FeatureIngestionRepository;

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
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.policyStatementService = new PolicyStatementService(connection);
    this.policyExpressionService = new PolicyExpressionService(connection);
    this.featureIngestionRepository = new FeatureIngestionRepository(connection);
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
    // Non-administrative flow: create a new ticket first, then attach the request artifacts to that ticket.
    const ticketService = new TicketService(this.connection);
    const ticket = await ticketService.createTicket({
      subject: this._generateTicketSubject(payload.reason, payload.featureTypes),
      description: payload.reason,
      priority: 'medium'
    });

    // Reuse the shared ticket-owned workflow once a ticket identifier is known.
    return this.createDataRequestForTicket(ticket.ticket_id, payload);
  }

  /**
   * Create a data request for an existing ticket.
   *
   * Creates separate teams for data-request access and policy ownership. When
   * feature types and an expression are provided, the expression tree is written
   * once and linked to each generated feature-type statement through a shared
   * policy expression.
   *
   * If no feature types are provided, the policy is created with no statements.
   *
   * @param {string} ticketId - Existing ticket identifier.
   * @param {CreateDataRequestPayload} payload - Ticket-owned create payload.
   * @return {Promise<DataRequest>} Created data request.
   * @memberof DataRequestService
   */
  async createDataRequestForTicket(ticketId: string, payload: CreateDataRequestPayload): Promise<DataRequest> {
    const [dataRequestTeam, policyTeam] = await Promise.all([
      this._createTeamWithMembers(payload.system_user_ids),
      this._createTeamWithMembers(payload.system_user_ids)
    ]);

    const featureTypes = payload.featureTypes ?? [];
    const statements: CreatePolicyStatementPayload[] = [];
    let expressionId: string | null = null;

    if (featureTypes.length > 0) {
      const activeFeatureTypes = await this.featureIngestionRepository.getActiveFeatureTypeMap();
      const activeFeatureTypeNames = new Set(activeFeatureTypes.map((row) => row.name));

      const unknownFeatureTypes = featureTypes.filter((featureType) => !activeFeatureTypeNames.has(featureType));

      if (unknownFeatureTypes.length > 0) {
        throw new HTTP400('Unknown feature type(s)', [{ unknownFeatureTypes }]);
      }

      if (payload.expression !== null && payload.expression !== undefined) {
        const expressionTree = await this.expressionTreeService.writeExpressionTree(payload.expression);
        expressionId = expressionTree.expression_id;
      }

      statements.push(
        ...featureTypes.map((featureType) => ({
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: `urn:*:${featureType}:*`
        }))
      );
    }

    const policy = await this.policyService.createPolicyWithStatements(
      {
        name: _generateDataRequestPolicyName(),
        description: 'Auto-generated policy for ticket-linked data request',
        status: 'requested'
      },
      statements
    );

    if (expressionId !== null) {
      const policyExpression = await this.policyExpressionService.ensurePolicyExpression({
        policyId: policy.policy_id,
        expressionId
      });

      for (const statement of policy.statements) {
        await this.policyStatementService.updatePolicyStatement(statement.policy_statement_id, {
          policy_expression_id: policyExpression.policy_expression_id
        });
      }
    }

    await this.teamPolicyService.createTeamPolicy({
      team_id: policyTeam.team_id,
      policy_id: policy.policy_id
    });

    const dataRequest = await this.dataRequestRepository.createDataRequest({
      requested_by: payload.requested_by,
      reason: payload.reason,
      team_id: dataRequestTeam.team_id,
      ticket_id: ticketId,
      policy_id: policy.policy_id
    });

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
   * Soft delete a data request and revoke its generated policy grant.
   *
   * Data-request access is implemented through the linked policy. Deleting only
   * the request wrapper would leave an approved policy and its team grants live.
   * Soft-delete the request row and policy together through `PolicyService` so
   * affected teams' `team_security_scope` rows are rebuilt from the remaining
   * policy chain.
   *
   * @param {string} dataRequestId - Data request UUID.
   * @return {Promise<void>}
   * @memberof DataRequestService
   */
  async deleteDataRequest(dataRequestId: string): Promise<void> {
    const dataRequest = await this.dataRequestRepository.getDataRequestById(dataRequestId);

    await Promise.all([
      this.dataRequestRepository.deleteDataRequest(dataRequestId),
      this.policyService.deletePolicy(dataRequest.policy_id)
    ]);
  }

  /**
   * Generate a stable subject for auto-created data request tickets.
   *
   * When a feature-type scope is supplied, the scope appears in the subject so reviewers
   * can identify the requested slice without opening the ticket body. The reason excerpt
   * (up to 10 words) is appended after an em-dash when present. When no scope is supplied,
   * the legacy `Data Request - <excerpt>` format is preserved.
   *
   * @private
   * @param {string} reason - Request reason.
   * @param {string[]} [featureTypes] - Optional feature-type scope for the request.
   * @return {string} Ticket subject — scope-prefixed when feature types are supplied, otherwise the legacy format.
   * @memberof DataRequestService
   */
  private _generateTicketSubject(reason: string, featureTypes?: string[]): string {
    const trimmed = reason.trim();
    const excerpt = trimmed ? trimmed.split(/\s+/).slice(0, 10).join(' ') : '';

    if (featureTypes && featureTypes.length > 0) {
      const joined = featureTypes.join(', ');
      return excerpt ? `Data Request: ${joined} — ${excerpt}` : `Data Request: ${joined}`;
    }

    return excerpt ? `Data Request - ${excerpt}` : 'Data Request';
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
    // Remove duplicate incoming member identifiers to avoid duplicate team-member inserts.
    const uniqueMemberIds = [...new Set(systemUserIds)];

    await Promise.all(
      uniqueMemberIds.map((systemUserId) =>
        this.teamMemberService.createTeamMember({ system_user_id: systemUserId, team_id: team.team_id })
      )
    );

    return team;
  }
}
