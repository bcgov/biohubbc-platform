import { IDBConnection } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import { CreatePolicyExpression, PolicyExpression, UpdatePolicyExpression } from '../../models/policy-expression';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { DBService } from '../db-service';
import { ExpressionTreeService } from '../expression-tree-service';

export class PolicyExpressionService extends DBService {
  policyExpressionRepository: PolicyExpressionRepository;
  expressionTreeService: ExpressionTreeService;

  /**
   * Build a policy-expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.policyExpressionRepository = new PolicyExpressionRepository(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
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
   * Point an existing policy-expression identity at another immutable expression anchor.
   *
   * This patches the existing policy_expression row instead of replacing it, so
   * any policy_statement.policy_expression_id references remain stable.
   *
   * @param {string} policyExpressionId - Existing policy-expression identifier.
   * @param {UpdatePolicyExpression} data - Replacement expression pointer.
   * @return {Promise<PolicyExpression>} Updated policy expression.
   */
  async updatePolicyExpression(policyExpressionId: string, data: UpdatePolicyExpression): Promise<PolicyExpression> {
    return this.policyExpressionRepository.updatePolicyExpression(policyExpressionId, data);
  }

  /**
   * Resolve an incoming expression-tree payload to an immutable expression anchor,
   * then patch the existing policy-expression identity to point at that anchor.
   *
   * Expression rows are never updated in place. The expression tree service
   * either reuses an existing expression_id for the same normalized tree or
   * creates a new immutable expression graph, and this service updates only the
   * policy_expression.expression_id pointer.
   *
   * @param {string} policyExpressionId - Existing policy-expression identifier.
   * @param {ExpressionTree} expression - Incoming expression tree payload.
   * @return {Promise<PolicyExpression>} Updated policy expression.
   */
  async updatePolicyExpressionTree(policyExpressionId: string, expression: ExpressionTree): Promise<PolicyExpression> {
    const { expression_id } = await this.expressionTreeService.writeExpressionTree(expression);
    return this.updatePolicyExpression(policyExpressionId, { expressionId: expression_id });
  }
}
