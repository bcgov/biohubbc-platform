import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreatePolicyExpression, PolicyExpression } from '../models/policy-expression';
import { BaseRepository } from './base-repository';

export class PolicyExpressionRepository extends BaseRepository {
  /**
   * Insert a policy-expression row.
   *
   * @param {CreatePolicyExpression} payload - Policy-expression payload.
   * @return {Promise<PolicyExpression>} Inserted row.
   */
  async insertPolicyExpression(payload: CreatePolicyExpression): Promise<PolicyExpression> {
    const knex = getKnex();
    const query = knex('policy_expression')
      .insert(payload)
      .returning(['policy_expression_id', 'policy_id', 'expression_id', 'name', 'description']);

    const response = await this.connection.knex(query, PolicyExpression);
    const rowCount = response.rowCount ?? 0;

    if (rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy_expression', [
        'PolicyExpressionRepository->insertPolicyExpression',
        `rowCount was ${rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch one active policy expression by id.
   *
   * @param {string} policyExpressionId - Policy-expression identifier.
   * @return {Promise<PolicyExpression>} Active policy-expression row.
   */
  async getPolicyExpressionById(policyExpressionId: string): Promise<PolicyExpression> {
    const knex = getKnex();
    const query = knex('policy_expression')
      .select(['policy_expression_id', 'policy_id', 'expression_id', 'name', 'description'])
      .where('policy_expression_id', policyExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('policy_expression not found', [
        'PolicyExpressionRepository->getPolicyExpressionById',
        { policyExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyExpressionRepository->getPolicyExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch active policy expressions for a policy.
   *
   * @param {string} policyId - Policy identifier.
   * @return {Promise<PolicyExpression[]>} Active policy expressions.
   */
  async getPolicyExpressionsByPolicyId(policyId: string): Promise<PolicyExpression[]> {
    const knex = getKnex();
    const query = knex('policy_expression')
      .select(['policy_expression_id', 'policy_id', 'expression_id', 'name', 'description'])
      .where('policy_id', policyId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyExpression);
    return response.rows;
  }

  /**
   * Fetch one active policy expression by policy and expression id.
   *
   * @param {string} policyId - Policy identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<PolicyExpression | null>} Matching row, if present.
   */
  async getPolicyExpressionByPolicyAndExpressionId(
    policyId: string,
    expressionId: string
  ): Promise<PolicyExpression | null> {
    const knex = getKnex();
    const query = knex('policy_expression')
      .select(['policy_expression_id', 'policy_id', 'expression_id', 'name', 'description'])
      .where('policy_id', policyId)
      .where('expression_id', expressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyExpression);

    if (response.rowCount === 0) {
      return null;
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyExpressionRepository->getPolicyExpressionByPolicyAndExpressionId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}
