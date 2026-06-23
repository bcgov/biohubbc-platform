import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreatePolicyStatementExpression,
  PolicyStatementExpression,
  PolicyStatementExpressionWithExpression
} from '../models/policy-statement-expression';
import { BaseRepository } from './base-repository';

export class PolicyStatementExpressionRepository extends BaseRepository {
  /**
   * Soft delete all active expression links for a policy statement by setting `record_end_date`.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @return {Promise<PolicyStatementExpression[]>} Soft-deleted link rows.
   */
  async deletePolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_statement_id', policyStatementId)
      .whereNull('record_end_date')
      .returning(['policy_statement_expression_id', 'policy_statement_id', 'policy_expression_id']);

    const response = await this.connection.knex(query, PolicyStatementExpression);
    return response.rows;
  }

  /**
   * Insert a policy-statement-to-expression link row.
   *
   * @param {CreatePolicyStatementExpression} payload - Link payload.
   * @return {Promise<PolicyStatementExpression>} Inserted link row.
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   */
  async insertPolicyStatementExpression(payload: CreatePolicyStatementExpression): Promise<PolicyStatementExpression> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .insert(payload)
      .returning(['policy_statement_expression_id', 'policy_statement_id', 'policy_expression_id']);

    const response = await this.connection.knex(query, PolicyStatementExpression);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy_statement_expression', [
        'PolicyStatementExpressionRepository->insertPolicyStatementExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch one active policy-statement-expression link by id.
   *
   * @param {string} policyStatementExpressionId - Link identifier.
   * @return {Promise<PolicyStatementExpression>} Matching active link row.
   * @throws {ApiNotFoundError} If no active row exists for the provided id.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   */
  async getPolicyStatementExpressionById(policyStatementExpressionId: string): Promise<PolicyStatementExpression> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .select(['policy_statement_expression_id', 'policy_statement_id', 'policy_expression_id'])
      .where('policy_statement_expression_id', policyStatementExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('policy_statement_expression not found', [
        'PolicyStatementExpressionRepository->getPolicyStatementExpressionById',
        { policyStatementExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyStatementExpressionRepository->getPolicyStatementExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch all active expression links for a policy statement, including the linked root expression id.
   *
   * @param {string} policyStatementId - Policy statement identifier.
   * @return {Promise<PolicyStatementExpressionWithExpression[]>} Active link rows.
   */
  async getPolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpressionWithExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_expression as pse')
      .select([
        'pse.policy_statement_expression_id',
        'pse.policy_statement_id',
        'pse.policy_expression_id',
        'pe.expression_id'
      ])
      .join('policy_expression as pe', 'pe.policy_expression_id', 'pse.policy_expression_id')
      .where('pse.policy_statement_id', policyStatementId)
      .whereNull('pse.record_end_date')
      .whereNull('pe.record_end_date');

    const response = await this.connection.knex(query, PolicyStatementExpressionWithExpression);
    return response.rows;
  }

  /**
   * Fetch all active policy-statement links that reference a policy expression.
   *
   * @param {string} policyExpressionId - Policy-expression identifier.
   * @return {Promise<PolicyStatementExpression[]>} Active link rows.
   */
  async getPolicyStatementExpressionsByPolicyExpressionId(
    policyExpressionId: string
  ): Promise<PolicyStatementExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .select(['policy_statement_expression_id', 'policy_statement_id', 'policy_expression_id'])
      .where('policy_expression_id', policyExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementExpression);
    return response.rows;
  }
}
