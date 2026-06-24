import { IDBConnection } from '../../database/db';
import { ApiValidationError } from '../../errors/api-error';
import { PolicyStatementExpressionWithExpression } from '../../models/policy-statement-expression';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { PolicyStatementExpressionRepository } from '../../repositories/policy-statement-expression-repository';
import { DBService } from '../db-service';

export class PolicyStatementExpressionService extends DBService {
  policyStatementExpressionRepository: PolicyStatementExpressionRepository;
  policyStatementRepository: PolicyStatementRepository;
  policyExpressionRepository: PolicyExpressionRepository;

  /**
   * Build a policy-statement expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementExpressionRepository = new PolicyStatementExpressionRepository(connection);
    this.policyStatementRepository = new PolicyStatementRepository(connection);
    this.policyExpressionRepository = new PolicyExpressionRepository(connection);
  }

  /**
   * Repoint a policy statement to the provided policy expression.
   *
   * Behavior:
   * 1. Load active statement->expression links.
   * 2. Return early when already linked to the requested policy expression.
   * 3. Soft-delete existing active links when the target changes.
   * 4. Insert the replacement link.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @param {string} policyExpressionId - Policy expression identifier.
   * @return {Promise<void>} Resolves once the link points to `policyExpressionId`.
   */
  async setPolicyStatementExpression(policyStatementId: string, policyExpressionId: string): Promise<void> {
    await this.assertPolicyExpressionBelongsToStatementPolicy(policyStatementId, policyExpressionId);

    const existingLinks =
      await this.policyStatementExpressionRepository.getPolicyStatementExpressionsByPolicyStatementId(
        policyStatementId
      );
    const alreadyLinked = existingLinks.length === 1 && existingLinks[0].policy_expression_id === policyExpressionId;

    if (alreadyLinked) {
      return;
    }

    if (existingLinks.length > 0) {
      await this.policyStatementExpressionRepository.deletePolicyStatementExpressionsByPolicyStatementId(
        policyStatementId
      );
    }

    await this.policyStatementExpressionRepository.insertPolicyStatementExpression({
      policy_statement_id: policyStatementId,
      policy_expression_id: policyExpressionId
    });
  }

  /**
   * Validate that the statement and policy expression belong to the same policy.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @param {string} policyExpressionId - Policy expression identifier.
   * @return {Promise<void>} Resolves when both rows belong to the same policy.
   */
  private async assertPolicyExpressionBelongsToStatementPolicy(
    policyStatementId: string,
    policyExpressionId: string
  ): Promise<void> {
    const [policyStatement, policyExpression] = await Promise.all([
      this.policyStatementRepository.getPolicyStatement(policyStatementId),
      this.policyExpressionRepository.getPolicyExpressionById(policyExpressionId)
    ]);

    if (policyStatement.policy_id !== policyExpression.policy_id) {
      throw new ApiValidationError('Policy expression does not belong to the policy statement policy', [
        'PolicyStatementExpressionService->setPolicyStatementExpression',
        { policyStatementId, policyExpressionId }
      ]);
    }
  }

  /**
   * Get active expression links for a policy statement.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @return {Promise<PolicyStatementExpressionWithExpression[]>} Active link rows.
   */
  async getPolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpressionWithExpression[]> {
    return this.policyStatementExpressionRepository.getPolicyStatementExpressionsByPolicyStatementId(policyStatementId);
  }
}
