import { IDBConnection } from '../../database/db';
import { ApiValidationError } from '../../errors/api-error';
import { CreatePolicyStatement, PolicyStatement, UpdatePolicyStatement } from '../../models/policy-statement';
import {
  ActivePolicyStatementWithExpression,
  PolicyStatementRepository
} from '../../repositories/authorization/policy-statement-repository';
import { TeamPolicyRepository } from '../../repositories/authorization/team-policy-repository';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { DBService } from '../db-service';
import { SecurityScopeService } from './security-scope-service';

export class PolicyStatementService extends DBService {
  policyStatementRepository: PolicyStatementRepository;
  policyExpressionRepository: PolicyExpressionRepository;
  securityScopeService: SecurityScopeService;
  teamPolicyRepository: TeamPolicyRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementRepository = new PolicyStatementRepository(connection);
    this.policyExpressionRepository = new PolicyExpressionRepository(connection);
    this.securityScopeService = new SecurityScopeService(connection);
    this.teamPolicyRepository = new TeamPolicyRepository(connection);
  }

  /**
   * Create a policy statement and refresh derived team access for the policy.
   *
   * The statement stores a reusable `security_scope_id` derived from the URN.
   * Creating a statement does not directly mutate anchors; anchor jobs are
   * queued through policy materialization when the policy has approved team
   * access.
   *
   * @param {CreatePolicyStatement} policyStatementData - Data required to create a new policy statement.
   * @return {Promise<PolicyStatement>} - The created policy statement record.
   * @memberof PolicyStatementService
   */
  async createPolicyStatement(policyStatementData: CreatePolicyStatement): Promise<PolicyStatement> {
    if (policyStatementData.policy_expression_id) {
      await this.assertPolicyExpressionBelongsToPolicy(
        policyStatementData.policy_id,
        policyStatementData.policy_expression_id
      );
    }

    const securityScope = await this.securityScopeService.ensureSecurityScope(
      policyStatementData.submission_feature_urn
    );
    const statement = await this.policyStatementRepository.insertPolicyStatement({
      policy_id: policyStatementData.policy_id,
      effect: policyStatementData.effect,
      security_scope_id: securityScope.security_scope_id,
      policy_expression_id: policyStatementData.policy_expression_id
    });

    await this.securityScopeService.refreshAccessForPolicy(statement.policy_id);

    return statement;
  }

  /**
   * Retrieve a policy statement record
   *
   * @param {string} policyStatementId - The ID of the policy statement to fetch.
   * @return {Promise<PolicyStatement>} - The policy statement record.
   * @memberof PolicyStatementService
   */
  getPolicyStatement(policyStatementId: string): Promise<PolicyStatement> {
    return this.policyStatementRepository.getPolicyStatement(policyStatementId);
  }

  /**
   * Retrieve multiple policy statement records for a policy
   *
   * @param {string} policyId - The ID of the policy to fetch statements for.
   * @return {Promise<PolicyStatement[]>} - The policy statement records.
   * @memberof PolicyStatementService
   */
  getPolicyStatements(policyId: string): Promise<PolicyStatement[]> {
    return this.policyStatementRepository.getPolicyStatements(policyId);
  }

  /**
   * Retrieve all active policy statements for a policy with their optional linked
   * expression ids in a single roundtrip.
   *
   * Used by the download pipeline to drive per-feature-type Parquet generation:
   * each row produces one Parquet file, and the linked expression id selects
   * between expression-tree evaluation and a broad feature-type projection.
   *
   * @param {string} policyId - The policy id whose active statements to fetch.
   * @return {Promise<ActivePolicyStatementWithExpression[]>} Active statements with optional expression ids.
   * @memberof PolicyStatementService
   */
  getActiveStatementsWithExpressionByPolicyId(policyId: string): Promise<ActivePolicyStatementWithExpression[]> {
    return this.policyStatementRepository.getActiveStatementsWithExpressionByPolicyId(policyId);
  }

  /**
   * Update a policy statement and refresh derived team access when its access
   * envelope changes.
   *
   * Changes to `policy_expression_id` only affect export filtering and do not
   * rebuild standing access. Changes to the policy id, effect, URN, or record
   * end date can change team grants, so the owning policy access cache is
   * refreshed. Scope anchors are retained as reusable cache rows.
   *
   * @param {string} policyStatementId - The ID of the policy statement to update.
   * @param {UpdatePolicyStatement} policyStatementData - Partial data to update the policy statement record.
   * @return {Promise<PolicyStatement>} - The updated policy statement record.
   * @memberof PolicyStatementService
   */
  async updatePolicyStatement(
    policyStatementId: string,
    policyStatementData: UpdatePolicyStatement
  ): Promise<PolicyStatement> {
    const existingStatement = await this.policyStatementRepository.getPolicyStatement(policyStatementId);
    this.assertStatementStaysOnPolicy(existingStatement, policyStatementData);
    const scopeFieldsChanged = this.hasScopeDefiningStatementChange(existingStatement, policyStatementData);
    const targetPolicyId = policyStatementData.policy_id ?? existingStatement.policy_id;

    if (policyStatementData.policy_expression_id) {
      await this.assertPolicyExpressionBelongsToPolicy(targetPolicyId, policyStatementData.policy_expression_id);
    }

    const securityScope =
      policyStatementData.submission_feature_urn === undefined
        ? null
        : await this.securityScopeService.ensureSecurityScope(policyStatementData.submission_feature_urn);

    const statement = await this.policyStatementRepository.updatePolicyStatement(policyStatementId, {
      policy_id: policyStatementData.policy_id,
      effect: policyStatementData.effect,
      security_scope_id: securityScope?.security_scope_id,
      policy_expression_id: policyStatementData.policy_expression_id,
      record_end_date: policyStatementData.record_end_date
    });

    if (scopeFieldsChanged) {
      const policyIdsToRefresh = new Set([statement.policy_id]);
      if (existingStatement.policy_id !== statement.policy_id) {
        policyIdsToRefresh.add(existingStatement.policy_id);
      }
      for (const policyId of policyIdsToRefresh) {
        await this.securityScopeService.refreshAccessForPolicy(policyId);
      }
    }

    return statement;
  }

  /**
   * Soft-delete a policy statement and rebuild affected team grants.
   *
   * Access is revoked by re-deriving `team_security_scope` from the remaining
   * active approved policy chain. `security_scope_anchor` rows are left intact
   * because anchors are reusable cache entries and do not grant access alone.
   *
   * @param {string} policyStatementId - The id of the policy statement to delete
   * @return {Promise<void>}
   * @memberof PolicyStatementService
   */
  async deletePolicyStatement(policyStatementId: string): Promise<void> {
    const statement = await this.policyStatementRepository.getPolicyStatement(policyStatementId);
    const affectedTeamIds = await this.getTeamIdsForPolicy(statement.policy_id);

    await this.policyStatementRepository.deletePolicyStatement(policyStatementId);
    await this.securityScopeService.rebuildTeamSecurityScopesForTeams(affectedTeamIds);
  }

  /**
   * Determine whether an update changes the standing-access envelope of a
   * policy statement.
   *
   * Policy-expression link changes are intentionally excluded because linked
   * expressions narrow exports/search result selection; they do not define
   * which teams have standing access to a scope.
   *
   * @private
   * @param {PolicyStatement} existingStatement - Current persisted statement row.
   * @param {UpdatePolicyStatement} policyStatementData - Incoming partial update.
   * @return {boolean} True when derived team access should be refreshed.
   * @memberof PolicyStatementService
   */
  private hasScopeDefiningStatementChange(
    existingStatement: PolicyStatement,
    policyStatementData: UpdatePolicyStatement
  ): boolean {
    return (
      (policyStatementData.policy_id !== undefined && policyStatementData.policy_id !== existingStatement.policy_id) ||
      (policyStatementData.effect !== undefined && policyStatementData.effect !== existingStatement.effect) ||
      (policyStatementData.submission_feature_urn !== undefined &&
        policyStatementData.submission_feature_urn !== existingStatement.submission_feature_urn) ||
      policyStatementData.record_end_date !== undefined
    );
  }

  /**
   * Fetch team ids linked to a policy.
   *
   * Used before statement deletion so team scope grants can be rebuilt after
   * the source statement is soft-deleted.
   *
   * @private
   * @param {string} policyId - Policy UUID whose linked teams should be fetched.
   * @return {Promise<string[]>} Team UUIDs linked to the policy.
   * @memberof PolicyStatementService
   */
  private async getTeamIdsForPolicy(policyId: string): Promise<string[]> {
    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    return teamPolicies.map((teamPolicy) => teamPolicy.team_id);
  }

  /**
   * Assert that a policy expression belongs to the same policy as the statement.
   *
   * Statement expressions are policy-scoped reusable filters. Linking an
   * expression from another policy would make the statement reference data
   * outside its policy ownership boundary.
   *
   * @private
   * @param {string} policyId - Policy UUID expected to own the expression.
   * @param {string} policyExpressionId - Policy expression UUID to validate.
   * @return {Promise<void>}
   * @throws {ApiValidationError} When the expression belongs to another policy.
   * @memberof PolicyStatementService
   */
  private async assertPolicyExpressionBelongsToPolicy(policyId: string, policyExpressionId: string): Promise<void> {
    const policyExpression = await this.policyExpressionRepository.getPolicyExpressionById(policyExpressionId);

    if (policyExpression.policy_id !== policyId) {
      throw new ApiValidationError('Policy expression does not belong to the policy statement policy', [
        'PolicyStatementService->assertPolicyExpressionBelongsToPolicy',
        { policyId, policyExpressionId }
      ]);
    }
  }

  /**
   * Assert that an update does not move a statement to another policy.
   *
   * Moving statements between policies would make cache reconciliation ambiguous:
   * callers need to know which policy lost access and which policy gained it.
   * Current mutation paths keep the policy stable and reject attempted moves.
   *
   * @private
   * @param {PolicyStatement} existingStatement - Current persisted statement row.
   * @param {UpdatePolicyStatement} policyStatementData - Incoming partial update.
   * @return {void}
   * @throws {ApiValidationError} When the update requests a different policy id.
   * @memberof PolicyStatementService
   */
  private assertStatementStaysOnPolicy(
    existingStatement: PolicyStatement,
    policyStatementData: UpdatePolicyStatement
  ): void {
    if (policyStatementData.policy_id === undefined || policyStatementData.policy_id === existingStatement.policy_id) {
      return;
    }

    throw new ApiValidationError('Policy statement cannot be moved to a different policy', [
      'PolicyStatementService->assertStatementStaysOnPolicy',
      {
        policyStatementId: existingStatement.policy_statement_id,
        currentPolicyId: existingStatement.policy_id,
        requestedPolicyId: policyStatementData.policy_id
      }
    ]);
  }
}
