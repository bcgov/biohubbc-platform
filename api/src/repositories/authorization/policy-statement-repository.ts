import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreatePolicyStatementRecord,
  PolicyStatement,
  UpdatePolicyStatementRecord
} from '../../models/policy-statement';
import { BaseRepository } from '../base-repository';

/**
 * Row shape for an active policy statement joined to its (optional) linked expression.
 *
 * The download pipeline reads one row per active statement on a policy and uses it to
 * decide, per feature type, whether to evaluate an expression tree (`expression_id` set)
 * or fall back to a broad "all features of this type" projection (`expression_id` null).
 *
 * The link is a LEFT JOIN because not every statement has a linked expression: a
 * statement without one means "everything of this feature type that the policy creator
 * can see at export time".
 */
export const ActivePolicyStatementWithExpression = z.object({
  policy_statement_id: z.string().uuid(),
  urn_feature_type: z.string(),
  expression_id: z.string().uuid().nullable()
});
export type ActivePolicyStatementWithExpression = z.infer<typeof ActivePolicyStatementWithExpression>;

/**
 * A repository class for accessing policy statement data.
 *
 * @export
 * @class PolicyStatementRepository
 * @extends {BaseRepository}
 */
export class PolicyStatementRepository extends BaseRepository {
  /**
   * Insert a new policy statement record.
   *
   * @param {CreatePolicyStatementRecord} policyStatementData - The data for the policy statement to insert.
   * @return {Promise<PolicyStatement>} - The created policy statement record.
   * @memberof PolicyStatementRepository
   */
  async insertPolicyStatement(policyStatementData: CreatePolicyStatementRecord): Promise<PolicyStatement> {
    const sqlStatement = SQL`
      WITH inserted AS (
        INSERT INTO policy_statement (
          policy_id,
          effect,
          security_scope_id,
          policy_expression_id
        )
        VALUES (
          ${policyStatementData.policy_id},
          ${policyStatementData.effect},
          ${policyStatementData.security_scope_id},
          ${policyStatementData.policy_expression_id ?? null}
        )
        RETURNING policy_statement_id, policy_id, effect, security_scope_id, policy_expression_id
      )
      SELECT
        inserted.policy_statement_id,
        inserted.policy_id,
        inserted.effect,
        inserted.security_scope_id,
        concat('urn:', ss.urn_submission_id, ':', ss.urn_feature_type, ':', ss.urn_feature_id) AS submission_feature_urn,
        inserted.policy_expression_id
      FROM inserted
      JOIN security_scope ss ON ss.security_scope_id = inserted.security_scope_id;
    `;

    const response = await this.connection.sql(sqlStatement, PolicyStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy statement', [
        'PolicyStatementRepository->insertPolicyStatement',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a policy statement record by ID.
   *
   * @param {string} policyStatementId - The ID of the policy statement to retrieve.
   * @return {Promise<PolicyStatement>} - The policy statement record.
   * @memberof PolicyStatementRepository
   */
  async getPolicyStatement(policyStatementId: string): Promise<PolicyStatement> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement as ps')
      .join('security_scope as ss', 'ss.security_scope_id', 'ps.security_scope_id')
      .select([
        'ps.policy_statement_id',
        'ps.policy_id',
        'ps.effect',
        'ps.security_scope_id',
        knex.raw(
          "concat('urn:', ss.urn_submission_id, ':', ss.urn_feature_type, ':', ss.urn_feature_id) as submission_feature_urn"
        ),
        'ps.policy_expression_id'
      ])
      .where('ps.policy_statement_id', policyStatementId)
      .whereNull('ps.record_end_date');

    const response = await this.connection.knex(query, PolicyStatement);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Policy statement not found', [
        'PolicyStatementRepository->getPolicyStatement',
        { policyStatementId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyStatementRepository->getPolicyStatement',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all policy statement records for a given policy.
   *
   * @param {string} policyId - The ID of the policy to fetch statements for.
   * @return {Promise<PolicyStatement[]>} - A list of policy statement records for the given policy.
   * @memberof PolicyStatementRepository
   */
  async getPolicyStatements(policyId: string): Promise<PolicyStatement[]> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement as ps')
      .join('security_scope as ss', 'ss.security_scope_id', 'ps.security_scope_id')
      .select([
        'ps.policy_statement_id',
        'ps.policy_id',
        'ps.effect',
        'ps.security_scope_id',
        knex.raw(
          "concat('urn:', ss.urn_submission_id, ':', ss.urn_feature_type, ':', ss.urn_feature_id) as submission_feature_urn"
        ),
        'ps.policy_expression_id'
      ])
      .where('ps.policy_id', policyId)
      .whereNull('ps.record_end_date');

    const response = await this.connection.knex(query, PolicyStatement);

    return response.rows;
  }

  /**
   * Get all active policy statements for a policy, each joined to its optional
   * linked expression id.
   *
   * Single roundtrip used by the download pipeline to decide what to export:
   * each row drives one Parquet file, and `expression_id` selects between an
   * expression-tree evaluation (set) and a broad "everything of this feature
   * type" projection (null).
   *
   * The join is a LEFT JOIN because the absence of an expression link is a
   * legitimate, distinct semantic state — not a missing-row error. Returns `[]`
   * for a policy with no active statements.
   *
   * Ordered by `urn_feature_type` so the caller's downstream loop produces a
   * stable, alphabetic sequence of Parquet files.
   *
   * @param {string} policyId - The policy id whose active statements to fetch.
   * @return {Promise<ActivePolicyStatementWithExpression[]>} Active statements with optional expression ids.
   * @memberof PolicyStatementRepository
   */
  async getActiveStatementsWithExpressionByPolicyId(policyId: string): Promise<ActivePolicyStatementWithExpression[]> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement as ps')
      .select<ActivePolicyStatementWithExpression[]>(
        'ps.policy_statement_id',
        'ss.urn_feature_type',
        'pe.expression_id'
      )
      .join('security_scope as ss', 'ss.security_scope_id', 'ps.security_scope_id')
      .leftJoin('policy_expression as pe', function () {
        this.on('pe.policy_expression_id', '=', 'ps.policy_expression_id')
          .andOn('pe.policy_id', '=', 'ps.policy_id')
          .andOnNull('pe.record_end_date');
      })
      .where('ps.policy_id', policyId)
      .whereNull('ps.record_end_date')
      .orderBy('ss.urn_feature_type');

    const response = await this.connection.knex(query, ActivePolicyStatementWithExpression);

    return response.rows;
  }

  /**
   * Update an existing policy statement record.
   *
   * @param {string} policyStatementId - The ID of the policy statement to update.
   * @param {UpdatePolicyStatementRecord} policyStatementData - The data to update.
   * @return {Promise<PolicyStatement>} - The updated policy statement record.
   * @memberof PolicyStatementRepository
   */
  async updatePolicyStatement(
    policyStatementId: string,
    policyStatementData: UpdatePolicyStatementRecord
  ): Promise<PolicyStatement> {
    const sqlStatement = SQL`
      WITH updated AS (
        UPDATE policy_statement
        SET
          policy_id = CASE WHEN ${policyStatementData.policy_id !== undefined} THEN ${
      policyStatementData.policy_id ?? null
    } ELSE policy_id END,
          effect = CASE WHEN ${policyStatementData.effect !== undefined} THEN ${
      policyStatementData.effect ?? null
    } ELSE effect END,
          security_scope_id = CASE WHEN ${policyStatementData.security_scope_id !== undefined} THEN ${
      policyStatementData.security_scope_id ?? null
    } ELSE security_scope_id END,
          policy_expression_id = CASE WHEN ${policyStatementData.policy_expression_id !== undefined} THEN ${
      policyStatementData.policy_expression_id ?? null
    } ELSE policy_expression_id END,
          record_end_date = CASE WHEN ${policyStatementData.record_end_date !== undefined} THEN ${
      policyStatementData.record_end_date ?? null
    } ELSE record_end_date END
        WHERE policy_statement_id = ${policyStatementId}
          AND record_end_date IS NULL
        RETURNING policy_statement_id, policy_id, effect, security_scope_id, policy_expression_id
      )
      SELECT
        updated.policy_statement_id,
        updated.policy_id,
        updated.effect,
        updated.security_scope_id,
        concat('urn:', ss.urn_submission_id, ':', ss.urn_feature_type, ':', ss.urn_feature_id) AS submission_feature_urn,
        updated.policy_expression_id
      FROM updated
      JOIN security_scope ss ON ss.security_scope_id = updated.security_scope_id;
    `;

    const response = await this.connection.sql(sqlStatement, PolicyStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update policy statement', [
        'PolicyStatementRepository->updatePolicyStatement',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Soft delete a policy statement record by ID.
   *
   * @param {string} policyStatementId - The ID of the policy statement to delete.
   * @return {Promise<void>}
   * @memberof PolicyStatementRepository
   */
  async deletePolicyStatement(policyStatementId: string): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_statement_id', policyStatementId)
      .whereNull('record_end_date')
      .returning(['policy_statement_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete policy statement', [
        'PolicyStatementRepository->deletePolicyStatement',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
