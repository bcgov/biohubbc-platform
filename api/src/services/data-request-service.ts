import { IDBConnection } from '../database/db';
import { HTTP400 } from '../errors/http-error';
import {
  CreateDataRequest,
  CreateDataRequestPayload,
  DataRequest,
  DataRequestFilters,
  UpdateDataRequest
} from '../models/data-request';
import { CreatePolicyStatementPayload, PolicyEffect } from '../models/policy-statement';
import { Team } from '../models/team';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { FeatureIngestionRepository } from '../repositories/ingestion/feature-ingestion-repository';
import { _generateDataRequestPolicyName, _generateDataRequestTeamName } from '../utils/data-request';
import { PolicyService } from './access-policy/policy-service';
import { PolicyStatementExpressionService } from './access-policy/policy-statement-expression-service';
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
  policyStatementExpressionService: PolicyStatementExpressionService;
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
    this.policyStatementExpressionService = new PolicyStatementExpressionService(connection);
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
   * Business rules this method encodes:
   *
   * - **Requester is always in both teams.** The `system_user_ids` picker captures
   *   *additional* collaborators, not the canonical access list. The requester is the
   *   principal subject of the request and must be a member of both the data-request
   *   team and the policy team. Without this, an empty picker would produce a
   *   zero-member policy team and silently break the approve-grant chain when the
   *   policy is later approved.
   * - **One expression tree, many statement links.** When `featureTypes` is supplied
   *   with a non-null expression, the expression tree is persisted once and linked to
   *   every per-feature-type statement using the same `expression_id`. This keeps
   *   `expression_tree` row counts proportional to requests, not to statements.
   * - **Pre-validate feature-type names against the live catalog.** A typo or stale
   *   frontend identifier would otherwise produce a policy describing an empty slice;
   *   failing fast keeps the transaction from creating half-built request artifacts.
   * - **Empty/omitted `featureTypes` preserves the deny-all baseline.** The
   *   administrative ticket-bound flow has no expression context and needs the
   *   reviewer-authored baseline; the reviewer hand-authors a real policy during the
   *   requested → reviewed → approved lifecycle.
   *
   * @param {string} ticketId - Existing ticket identifier.
   * @param {CreateDataRequestPayload} payload - Ticket-owned create payload.
   * @return {Promise<DataRequest>} Created data request.
   * @memberof DataRequestService
   */
  async createDataRequestForTicket(ticketId: string, payload: CreateDataRequestPayload): Promise<DataRequest> {
    // Always include the requester in both teams. The picker captures additional collaborators,
    // not the canonical access list — the requester is the principal subject of the request and
    // must receive access if the policy is later approved.
    const members = Array.from(new Set([payload.requested_by, ...payload.system_user_ids]));

    const [dataRequestTeam, policyTeam] = await Promise.all([
      this._createTeamWithMembers(members),
      this._createTeamWithMembers(members)
    ]);

    // Branch on whether the caller supplied an explicit feature-type scope.
    const featureTypes = payload.featureTypes ?? [];
    let statements: CreatePolicyStatementPayload[];
    let expressionId: string | null = null;

    if (featureTypes.length > 0) {
      // Pre-validate feature-type names against the live catalog. A typo or stale frontend
      // identifier would otherwise produce a policy describing an empty slice; failing fast
      // keeps the transaction from creating half-built request artifacts.
      const active = await this.featureIngestionRepository.getActiveFeatureTypeMap();
      const known = new Set(active.map((row) => row.name));
      const unknown = featureTypes.filter((name) => !known.has(name));
      if (unknown.length > 0) {
        throw new HTTP400('Unknown feature type(s)', [{ unknownFeatureTypes: unknown }]);
      }

      // Persist the expression once, link to every statement (one tree, many links). We do NOT
      // put `expression` on the CreatePolicyStatementPayload elements — PolicyService would then
      // call writeExpressionTree per statement, producing duplicate expression_tree rows.
      if (payload.expression !== null && payload.expression !== undefined) {
        const result = await this.expressionTreeService.writeExpressionTree(payload.expression);
        expressionId = result.expression_id;
      }

      statements = featureTypes.map((featureType) => ({
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: `urn:*:${featureType}:*`
      }));
    } else {
      // Admin ticket-bound flow has no expression context. Preserve today's deny-all baseline
      // so the reviewer can hand-author a real policy during the requested → reviewed → approved
      // lifecycle.
      statements = [{ effect: PolicyEffect.DENY, submission_feature_urn: 'urn:*:*:*' }];
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
      for (const statement of policy.statements) {
        await this.policyStatementExpressionService.replacePolicyStatementExpression(
          statement.policy_statement_id,
          expressionId
        );
      }
    }

    // Explicitly associate the policy team with the policy so membership grants policy visibility/control.
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
    const uniqueMemberIds = Array.from(new Set(systemUserIds));

    await Promise.all(
      uniqueMemberIds.map((systemUserId) =>
        this.teamMemberService.createTeamMember({ system_user_id: systemUserId, team_id: team.team_id })
      )
    );

    return team;
  }
}
