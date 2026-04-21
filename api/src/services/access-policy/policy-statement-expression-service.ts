import { IDBConnection } from '../../database/db';
import { PolicyStatementExpression } from '../../models/policy-statement-expression';
import { PolicyStatementExpressionRepository } from '../../repositories/policy-statement-expression-repository';
import { DBService } from '../db-service';

export class PolicyStatementExpressionService extends DBService {
  policyStatementExpressionRepository: PolicyStatementExpressionRepository;

  /**
   * Build a policy-statement expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementExpressionRepository = new PolicyStatementExpressionRepository(connection);
  }

  /**
   * Repoint a policy statement to the provided expression.
   *
   * Behavior:
   * 1. Load active statement->expression links.
   * 2. Return early when already linked to the requested expression.
   * 3. Soft-delete existing active links when the target changes.
   * 4. Insert the replacement link.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<void>} Resolves once the link points to `expressionId`.
   */
  async replacePolicyStatementExpression(policyStatementId: string, expressionId: string): Promise<void> {
    const existingLinks =
      await this.policyStatementExpressionRepository.getPolicyStatementExpressionsByPolicyStatementId(
        policyStatementId
      );
    const alreadyLinked = existingLinks.length === 1 && existingLinks[0].expression_id === expressionId;

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
      expression_id: expressionId
    });
  }

  /**
   * Get active expression links for a policy statement.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @return {Promise<PolicyStatementExpression[]>} Active link rows.
   */
  async getPolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpression[]> {
    return this.policyStatementExpressionRepository.getPolicyStatementExpressionsByPolicyStatementId(policyStatementId);
  }
}
