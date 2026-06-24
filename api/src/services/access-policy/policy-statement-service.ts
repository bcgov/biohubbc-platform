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
   * Create a new policy statement record.
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

    const statement = await this.policyStatementRepository.insertPolicyStatement(policyStatementData);

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
   * Update an existing policy statement record.
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

    const statement = await this.policyStatementRepository.updatePolicyStatement(
      policyStatementId,
      policyStatementData
    );

    if (scopeFieldsChanged) {
      const affectedTeamIds = await this.getTeamIdsForPolicy(existingStatement.policy_id);
      await this.securityScopeService.cleanupScopesForDeletedStatements([policyStatementId], affectedTeamIds);
    }

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
   * Delete a policy statement record.
   *
   * @param {string} policyStatementId - The id of the policy statement to delete
   * @return {Promise<void>}
   * @memberof PolicyStatementService
   */
  async deletePolicyStatement(policyStatementId: string): Promise<void> {
    const statement = await this.policyStatementRepository.getPolicyStatement(policyStatementId);
    const affectedTeamIds = await this.getTeamIdsForPolicy(statement.policy_id);

    await this.policyStatementRepository.deletePolicyStatement(policyStatementId);
    await this.securityScopeService.cleanupScopesForDeletedStatements([policyStatementId], affectedTeamIds);
  }

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

  private async getTeamIdsForPolicy(policyId: string): Promise<string[]> {
    const teamPolicies = await this.teamPolicyRepository.getTeamPolicies({ policyIds: [policyId] });
    return teamPolicies.map((teamPolicy) => teamPolicy.team_id);
  }

  private async assertPolicyExpressionBelongsToPolicy(policyId: string, policyExpressionId: string): Promise<void> {
    const policyExpression = await this.policyExpressionRepository.getPolicyExpressionById(policyExpressionId);

    if (policyExpression.policy_id !== policyId) {
      throw new ApiValidationError('Policy expression does not belong to the policy statement policy', [
        'PolicyStatementService->assertPolicyExpressionBelongsToPolicy',
        { policyId, policyExpressionId }
      ]);
    }
  }

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
