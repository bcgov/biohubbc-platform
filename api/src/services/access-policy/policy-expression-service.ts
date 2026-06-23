import { IDBConnection } from '../../database/db';
import { PolicyExpression } from '../../models/policy-expression';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { DBService } from '../db-service';

export class PolicyExpressionService extends DBService {
  policyExpressionRepository: PolicyExpressionRepository;

  /**
   * Build a policy-expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyExpressionRepository = new PolicyExpressionRepository(connection);
  }

  /**
   * Return the active policy-expression row for a policy/expression pair,
   * creating it when it does not already exist.
   *
   * @param {string} policyId - Policy identifier.
   * @param {string} expressionId - Root expression identifier.
   * @return {Promise<PolicyExpression>} Existing or created policy expression.
   */
  async ensurePolicyExpression(
    policyId: string,
    expressionId: string,
    options?: { name?: string; description?: string | null }
  ): Promise<PolicyExpression> {
    const existing = await this.policyExpressionRepository.getPolicyExpressionByPolicyAndExpressionId(
      policyId,
      expressionId
    );

    if (existing) {
      return existing;
    }

    return this.policyExpressionRepository.insertPolicyExpression({
      policy_id: policyId,
      expression_id: expressionId,
      name: options?.name ?? null,
      description: options?.description ?? null
    });
  }

  /**
   * Fetch one active policy expression by id.
   *
   * @param {string} policyExpressionId - Policy-expression identifier.
   * @return {Promise<PolicyExpression>} Active policy expression.
   */
  getPolicyExpressionById(policyExpressionId: string): Promise<PolicyExpression> {
    return this.policyExpressionRepository.getPolicyExpressionById(policyExpressionId);
  }
}
