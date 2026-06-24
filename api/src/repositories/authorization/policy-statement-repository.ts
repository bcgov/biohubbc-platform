import { z } from 'zod';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CreatePolicyStatement, PolicyStatement, UpdatePolicyStatement } from '../../models/policy-statement';
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
   * @param {CreatePolicyStatement} policyStatementData - The data for the policy statement to insert.
   * @return {Promise<PolicyStatement>} - The created policy statement record.
   * @memberof PolicyStatementRepository
   */
  async insertPolicyStatement(policyStatementData: CreatePolicyStatement): Promise<PolicyStatement> {
    const knex = getKnex();
    const query = knex
      .table('policy_statement')
      .insert({
        policy_id: policyStatementData.policy_id,
        effect: policyStatementData.effect,
        submission_feature_urn: policyStatementData.submission_feature_urn,
        policy_expression_id: policyStatementData.policy_expression_id ?? null
      })
      .returning(['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn', 'policy_expression_id']);

    const response = await this.connection.knex(query, PolicyStatement);

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
      .select([
        'ps.policy_statement_id',
        'ps.policy_id',
        'ps.effect',
        'ps.submission_feature_urn',
        'ps.policy_expression_id'
      ])
      .where('ps.policy_statement_id', policyStatementId);

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
      .select([
        'ps.policy_statement_id',
        'ps.policy_id',
        'ps.effect',
        'ps.submission_feature_urn',
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
        'ps.urn_feature_type',
        'pe.expression_id'
      )
      .leftJoin('policy_expression as pe', function () {
        this.on('pe.policy_expression_id', '=', 'ps.policy_expression_id')
          .andOn('pe.policy_id', '=', 'ps.policy_id')
          .andOnNull('pe.record_end_date');
      })
      .where('ps.policy_id', policyId)
      .whereNull('ps.record_end_date')
      .orderBy('ps.urn_feature_type');

    const response = await this.connection.knex(query, ActivePolicyStatementWithExpression);

    return response.rows;
  }

  /**
   * Update an existing policy statement record.
   *
   * @param {string} policyStatementId - The ID of the policy statement to update.
   * @param {UpdatePolicyStatement} policyStatementData - The data to update.
   * @return {Promise<PolicyStatement>} - The updated policy statement record.
   * @memberof PolicyStatementRepository
   */
  async updatePolicyStatement(
    policyStatementId: string,
    policyStatementData: UpdatePolicyStatement
  ): Promise<PolicyStatement> {
    const knex = getKnex();
    const updateData: Record<string, string | null | undefined> = {};

    if (policyStatementData.policy_id !== undefined) {
      updateData.policy_id = policyStatementData.policy_id;
    }
    if (policyStatementData.effect !== undefined) {
      updateData.effect = policyStatementData.effect;
    }
    if (policyStatementData.submission_feature_urn !== undefined) {
      updateData.submission_feature_urn = policyStatementData.submission_feature_urn;
    }
    if (policyStatementData.policy_expression_id !== undefined) {
      updateData.policy_expression_id = policyStatementData.policy_expression_id;
    }
    if (policyStatementData.record_end_date !== undefined) {
      updateData.record_end_date = policyStatementData.record_end_date;
    }

    const query = knex
      .table('policy_statement')
      .update(updateData)
      .where('policy_statement_id', policyStatementId)
      .returning(['policy_statement_id', 'policy_id', 'effect', 'submission_feature_urn', 'policy_expression_id']);

    const response = await this.connection.knex(query, PolicyStatement);

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
