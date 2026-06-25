import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreatePolicyExpression, PolicyExpression, UpdatePolicyExpression } from '../models/policy-expression';
import { BaseRepository } from './base-repository';

export class PolicyExpressionRepository extends BaseRepository {
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
   * Return the active policy-expression row for a policy/expression pair,
   * creating it if needed.
   *
   * Uses an advisory lock to prevent concurrent inserts for the same pair.
   *
   * @param {CreatePolicyExpression} payload - Policy-expression creation payload.
   * @returns {Promise<PolicyExpression>} Existing or inserted policy-expression row.
   * @throws {ApiExecuteSQLError} If the row cannot be ensured.
   */
  async ensurePolicyExpression(payload: CreatePolicyExpression): Promise<PolicyExpression> {
    const sqlStatement = SQL`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext('policy_expression'),
          hashtext(json_build_array(${payload.policyId}, ${payload.expressionId})::text)
        )
      ),
      existing_policy_expression AS (
        SELECT
          policy_expression.policy_expression_id,
          policy_expression.policy_id,
          policy_expression.expression_id,
          policy_expression.name,
          policy_expression.description
        FROM policy_expression, advisory_lock
        WHERE policy_expression.policy_id = ${payload.policyId}
          AND policy_expression.expression_id = ${payload.expressionId}
          AND policy_expression.record_end_date IS NULL
      ),
      inserted_policy_expression AS (
        INSERT INTO policy_expression (
          policy_id,
          expression_id,
          name,
          description
        )
        SELECT
          ${payload.policyId},
          ${payload.expressionId},
          ${payload.name ?? null},
          ${payload.description ?? null}
        FROM advisory_lock
        WHERE NOT EXISTS (
          SELECT 1
          FROM existing_policy_expression
        )
        RETURNING
          policy_expression_id,
          policy_id,
          expression_id,
          name,
          description
      )
      SELECT
        COALESCE(existing_policy_expression.policy_expression_id, inserted_policy_expression.policy_expression_id) AS policy_expression_id,
        COALESCE(existing_policy_expression.policy_id, inserted_policy_expression.policy_id) AS policy_id,
        COALESCE(existing_policy_expression.expression_id, inserted_policy_expression.expression_id) AS expression_id,
        COALESCE(existing_policy_expression.name, inserted_policy_expression.name) AS name,
        COALESCE(existing_policy_expression.description, inserted_policy_expression.description) AS description
      FROM (SELECT 1) result
      LEFT JOIN existing_policy_expression ON TRUE
      LEFT JOIN inserted_policy_expression ON TRUE
      WHERE COALESCE(
        existing_policy_expression.policy_expression_id,
        inserted_policy_expression.policy_expression_id
      ) IS NOT NULL;
    `;

    const response = await this.connection.sql(sqlStatement, PolicyExpression);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to ensure policy_expression', [
        'PolicyExpressionRepository->ensurePolicyExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Patch an existing policy-expression identity to point at a different immutable expression anchor.
   *
   * The policy_expression row is policy-owned identity. Updates intentionally
   * mutate this pointer instead of soft-deleting the policy_expression and
   * inserting a replacement row, so statement links keep the same
   * policy_expression_id while the referenced expression tree changes.
   *
   * @param {string} policyExpressionId - Existing policy-expression identifier.
   * @param {UpdatePolicyExpression} payload - Replacement expression pointer.
   * @returns {Promise<PolicyExpression>} Updated policy-expression row.
   */
  async updatePolicyExpression(policyExpressionId: string, payload: UpdatePolicyExpression): Promise<PolicyExpression> {
    const knex = getKnex();
    const query = knex('policy_expression')
      .update({
        expression_id: payload.expressionId
      })
      .where('policy_expression_id', policyExpressionId)
      .whereNull('record_end_date')
      .returning(['policy_expression_id', 'policy_id', 'expression_id', 'name', 'description']);

    const response = await this.connection.knex(query, PolicyExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('policy_expression not found', [
        'PolicyExpressionRepository->updatePolicyExpression',
        { policyExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update policy_expression', [
        'PolicyExpressionRepository->updatePolicyExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
