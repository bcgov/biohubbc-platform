import { IDBConnection } from '../../database/db';
import { ExpressionTree } from '../../models/expression-tree';
import {
  CreatePolicyExpression,
  PolicyExpression,
  UpdatePolicyExpression,
  UpdatePolicyExpressionForPolicy
} from '../../models/policy-expression';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
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
   * Insert a new user-visible policy-expression identity.
   *
   * @param {CreatePolicyExpression} data - Policy-expression payload.
   * @return {Promise<PolicyExpression>} Inserted policy expression.
   */
  async createPolicyExpression(data: CreatePolicyExpression): Promise<PolicyExpression> {
    return this.policyExpressionRepository.insertPolicyExpression(data);
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

  /**
   * Fetch one active policy expression by policy and expression anchor.
   *
   * @param {string} policyId - Policy identifier.
   * @param {string} expressionId - Expression anchor identifier.
   * @return {Promise<PolicyExpression | null>} Matching active policy expression, when present.
   */
  getPolicyExpressionByPolicyAndExpressionId(policyId: string, expressionId: string): Promise<PolicyExpression | null> {
    return this.policyExpressionRepository.getPolicyExpressionByPolicyAndExpressionId(policyId, expressionId);
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

  /**
   * Fetch active policy expressions for a policy.
   *
   * @param {string} policyId - Policy identifier.
   * @return {Promise<PolicyExpression[]>} Active policy expressions.
   */
  getPolicyExpressionsByPolicyId(policyId: string, pagination?: ApiPaginationOptions): Promise<PolicyExpression[]> {
    return this.policyExpressionRepository.getPolicyExpressionsByPolicyId(policyId, pagination);
  }

  /**
   * Count active policy expressions for a policy.
   *
   * @param {string} policyId - Policy identifier.
   * @return {Promise<number>} Active policy expression count.
   */
  getPolicyExpressionsCountByPolicyId(policyId: string): Promise<number> {
    return this.policyExpressionRepository.getPolicyExpressionsCountByPolicyId(policyId);
  }

  /**
   * Update an active policy expression scoped to a policy.
   *
   * @param {string} policyId - Policy identifier.
   * @param {string} policyExpressionId - Policy-expression identifier.
   * @param {Pick<PolicyExpression, 'expression_id' | 'name' | 'description'>} payload - Update payload.
   * @return {Promise<PolicyExpression>} Updated policy expression.
   */
  updatePolicyExpressionForPolicy(
    policyId: string,
    policyExpressionId: string,
    payload: UpdatePolicyExpressionForPolicy
  ): Promise<PolicyExpression> {
    return this.policyExpressionRepository.updatePolicyExpressionForPolicy(policyId, policyExpressionId, payload);
  }

  /**
   * Check whether an active policy expression is referenced by active statements.
   *
   * @param {string} policyId - Policy identifier.
   * @param {string} policyExpressionId - Policy-expression identifier.
   * @return {Promise<boolean>} True when an active statement still references the expression.
   */
  hasActivePolicyStatementReferences(policyId: string, policyExpressionId: string): Promise<boolean> {
    return this.policyExpressionRepository.hasActivePolicyStatementReferences(policyId, policyExpressionId);
  }

  /**
   * Soft delete an active policy expression scoped to a policy.
   *
   * @param {string} policyId - Policy identifier.
   * @param {string} policyExpressionId - Policy-expression identifier.
   * @return {Promise<void>}
   */
  deletePolicyExpression(policyId: string, policyExpressionId: string): Promise<void> {
    return this.policyExpressionRepository.deletePolicyExpression(policyId, policyExpressionId);
  }
}
