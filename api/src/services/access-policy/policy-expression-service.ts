import { IDBConnection } from '../../database/db';
import { CreatePolicyExpression, PolicyExpression } from '../../models/policy-expression';
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
   * @param {CreatePolicyExpression} data
   * @return {Promise<PolicyExpression>} Existing or created policy expression.
   */
  async ensurePolicyExpression(data: CreatePolicyExpression): Promise<PolicyExpression> {
    return this.policyExpressionRepository.ensurePolicyExpression(data);
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
