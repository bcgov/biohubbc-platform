import { IDBConnection } from '../../database/db';
import { PolicyStatementConditionExpressionRepository } from '../../repositories/policy-statement-condition-expression-repository';
import { DBService } from '../db-service';

export class PolicyStatementConditionExpressionService extends DBService {
  policyStatementConditionExpressionRepository: PolicyStatementConditionExpressionRepository;

  /**
   * Build a policy-statement-condition expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementConditionExpressionRepository = new PolicyStatementConditionExpressionRepository(connection);
  }

  /**
   * Repoint a policy statement condition to the provided expression.
   *
   * Behavior:
   * 1. Load active condition->expression links.
   * 2. Return early when already linked to the requested expression.
   * 3. Soft-delete existing links when the target changes.
   * 4. Insert the replacement active link.
   *
   * @param {string} policyStatementConditionId - Policy statement condition identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<void>} Resolves once the link points to `expressionId`.
   */
  async replacePolicyStatementConditionExpression(
    policyStatementConditionId: string,
    expressionId: string
  ): Promise<void> {
    const existingLinks =
      await this.policyStatementConditionExpressionRepository.getPolicyStatementConditionExpressionsByPolicyStatementConditionId(
        policyStatementConditionId
      );
    const alreadyLinked = existingLinks.length === 1 && existingLinks[0].expression_id === expressionId;

    if (alreadyLinked) {
      return;
    }

    if (existingLinks.length > 0) {
      await this.policyStatementConditionExpressionRepository.deletePolicyStatementConditionExpressionsByPolicyStatementConditionId(
        policyStatementConditionId
      );
    }

    await this.policyStatementConditionExpressionRepository.insertPolicyStatementConditionExpression({
      policy_statement_condition_id: policyStatementConditionId,
      expression_id: expressionId
    });
  }
}
