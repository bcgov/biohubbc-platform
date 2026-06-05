import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreatePolicyStatementConditionExpression,
  PolicyStatementConditionExpression
} from '../models/policy-statement-condition-expression';
import { BaseRepository } from './base-repository';

export class PolicyStatementConditionExpressionRepository extends BaseRepository {
  /**
   * Soft delete all active expression links for a policy statement condition by setting `record_end_date`.
   *
   * @param {string} policyStatementConditionId - Policy statement condition identifier.
   * @return {Promise<PolicyStatementConditionExpression[]>} Soft-deleted link rows.
   */
  async deletePolicyStatementConditionExpressionsByPolicyStatementConditionId(
    policyStatementConditionId: string
  ): Promise<PolicyStatementConditionExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_condition_expression')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_statement_condition_id', policyStatementConditionId)
      .whereNull('record_end_date')
      .returning(['policy_statement_condition_expression_id', 'policy_statement_condition_id', 'expression_id']);

    const response = await this.connection.knex(query, PolicyStatementConditionExpression);
    return response.rows;
  }

  /**
   * Insert a policy-statement-condition-to-expression link row.
   *
   * @param {CreatePolicyStatementConditionExpression} payload - Link payload.
   * @return {Promise<PolicyStatementConditionExpression>} Inserted link row.
   */
  async insertPolicyStatementConditionExpression(
    payload: CreatePolicyStatementConditionExpression
  ): Promise<PolicyStatementConditionExpression> {
    const knex = getKnex();
    const query = knex('policy_statement_condition_expression')
      .insert(payload)
      .returning(['policy_statement_condition_expression_id', 'policy_statement_condition_id', 'expression_id']);

    const response = await this.connection.knex(query, PolicyStatementConditionExpression);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy_statement_condition_expression', [
        'PolicyStatementConditionExpressionRepository->insertPolicyStatementConditionExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch one active policy-statement-condition-expression link by id.
   *
   * @param {string} policyStatementConditionExpressionId - Link identifier.
   * @return {Promise<PolicyStatementConditionExpression>} Matching active link row.
   */
  async getPolicyStatementConditionExpressionById(
    policyStatementConditionExpressionId: string
  ): Promise<PolicyStatementConditionExpression> {
    const knex = getKnex();
    const query = knex('policy_statement_condition_expression')
      .select(['policy_statement_condition_expression_id', 'policy_statement_condition_id', 'expression_id'])
      .where('policy_statement_condition_expression_id', policyStatementConditionExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementConditionExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('policy_statement_condition_expression not found', [
        'PolicyStatementConditionExpressionRepository->getPolicyStatementConditionExpressionById',
        { policyStatementConditionExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyStatementConditionExpressionRepository->getPolicyStatementConditionExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch all active expression links for a policy statement condition.
   *
   * @param {string} policyStatementConditionId - Policy statement condition identifier.
   * @return {Promise<PolicyStatementConditionExpression[]>} Active link rows.
   */
  async getPolicyStatementConditionExpressionsByPolicyStatementConditionId(
    policyStatementConditionId: string
  ): Promise<PolicyStatementConditionExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_condition_expression')
      .select(['policy_statement_condition_expression_id', 'policy_statement_condition_id', 'expression_id'])
      .where('policy_statement_condition_id', policyStatementConditionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementConditionExpression);
    return response.rows;
  }

  /**
   * Fetch all active policy-condition links that reference an expression.
   *
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<PolicyStatementConditionExpression[]>} Active link rows.
   */
  async getPolicyStatementConditionExpressionsByExpressionId(
    expressionId: string
  ): Promise<PolicyStatementConditionExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_condition_expression')
      .select(['policy_statement_condition_expression_id', 'policy_statement_condition_id', 'expression_id'])
      .where('expression_id', expressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementConditionExpression);
    return response.rows;
  }
}
