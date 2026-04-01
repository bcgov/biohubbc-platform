import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateExpressionClause, ExpressionClause } from '../models/expression-clause';
import { BaseRepository } from './base-repository';

export class ExpressionClauseRepository extends BaseRepository {
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
}
