import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateExpressionClause, ExpressionClause } from '../models/expression-clause';
import { BaseRepository } from './base-repository';

export class ExpressionClauseRepository extends BaseRepository {
  /**
   * Insert a batch of expression clauses.
   *
   * Clause rows are expected to be pre-resolved to anchor ids and include the
   * final clause order (`sequence`) for the owning expression.
   *
   * @param {CreateExpressionClause[]} payloads - Clause rows to insert.
   * @return {Promise<ExpressionClause[]>} Inserted clause rows.
   * @throws {ApiExecuteSQLError} If the insert does not affect all payload rows.
   */
  async insertExpressionClauses(payloads: CreateExpressionClause[]): Promise<ExpressionClause[]> {
    if (payloads.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex('expression_clause')
      .insert(payloads)
      .returning(['expression_clause_id', 'expression_id', 'sequence', 'predicate_id', 'child_expression_id']);

    const response = await this.connection.knex(query, ExpressionClause);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert expression_clause batch', [
        'ExpressionClauseRepository->insertExpressionClauses',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Fetch all active clauses for an expression in sequence order.
   *
   * @param {string} expressionId - Parent expression identifier.
   * @return {Promise<ExpressionClause[]>} Active ordered clause rows.
   */
  async getExpressionClausesByExpressionId(expressionId: string): Promise<ExpressionClause[]> {
    const knex = getKnex();
    const query = knex('expression_clause')
      .select(['expression_clause_id', 'expression_id', 'sequence', 'predicate_id', 'child_expression_id'])
      .where('expression_id', expressionId)
      .whereNull('record_end_date')
      .orderBy('sequence', 'asc');

    const response = await this.connection.knex(query, ExpressionClause);
    return response.rows;
  }

  /**
   * Fetch all active clauses for multiple expressions in expression/sequence order.
   *
   * @param {string[]} expressionIds - Parent expression identifiers.
   * @return {Promise<ExpressionClause[]>} Active ordered clause rows.
   */
  async getExpressionClausesByExpressionIds(expressionIds: string[]): Promise<ExpressionClause[]> {
    if (expressionIds.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex('expression_clause')
      .select(['expression_clause_id', 'expression_id', 'sequence', 'predicate_id', 'child_expression_id'])
      .whereIn('expression_id', [...new Set(expressionIds)])
      .whereNull('record_end_date')
      .orderBy([
        { column: 'expression_id', order: 'asc' },
        { column: 'sequence', order: 'asc' }
      ]);

    const response = await this.connection.knex(query, ExpressionClause);
    return response.rows;
  }
}
