import { IDBConnection } from '../../database/db';
import { PolicyStatementExpression } from '../../models/policy-statement-expression';
import { PolicyStatementExpressionRepository } from '../../repositories/policy-statement-expression-repository';
import { DBService } from '../db-service';

export class PolicyStatementExpressionService extends DBService {
  policyStatementExpressionRepository: PolicyStatementExpressionRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.policyStatementExpressionRepository = new PolicyStatementExpressionRepository(connection);
  }

  /**
   * Repoint a policy statement to the provided expression.
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
   */
  async getPolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpression[]> {
    return this.policyStatementExpressionRepository.getPolicyStatementExpressionsByPolicyStatementId(policyStatementId);
  }
}
