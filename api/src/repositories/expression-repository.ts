import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Expression, ExpressionHashRow } from '../models/expression';
import { LogicalOperator } from '../models/logical-operator';
import { BaseRepository } from './base-repository';

export class ExpressionRepository extends BaseRepository {
  async insertExpressionAnchor(operator: LogicalOperator, expressionHash: string): Promise<Expression | undefined> {
    const insertSql = SQL`
      INSERT INTO expression (
        operator,
        expression_hash
      )
      VALUES (
        ${operator}::logical_operator_type,
        ${expressionHash}
      )
      ON CONFLICT (expression_hash) WHERE record_end_date IS NULL
      DO NOTHING
      RETURNING expression_id, operator::text AS operator;
    `;
    const response = await this.connection.sql(insertSql, Expression);
    const rowCount = response.rowCount ?? 0;

    if (rowCount > 1) {
      throw new ApiExecuteSQLError('Failed to insert expression anchor', [
        'ExpressionRepository->insertExpressionAnchor',
        `rowCount was ${rowCount}, expected 0 or 1`
      ]);
    }

    return response.rows[0];
  }

  async getExpressionByHash(expressionHash: string): Promise<ExpressionHashRow | undefined> {
    const knex = getKnex();
    const query = knex('expression')
      .select(['expression_id', 'expression_hash'])
      .where('expression_hash', expressionHash)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, ExpressionHashRow);
    const rowCount = response.rowCount ?? 0;

    if (rowCount > 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ExpressionRepository->getExpressionByHash',
        `expected rowCount=0|1, actual rowCount=${rowCount}`
      ]);
    }

    return response.rows[0];
  }

  async getExpressionsByHashes(expressionHashes: string[]): Promise<ExpressionHashRow[]> {
    if (expressionHashes.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex('expression')
      .select(['expression_id', 'expression_hash'])
      .whereIn('expression_hash', [...new Set(expressionHashes)])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, ExpressionHashRow);
    return response.rows;
  }

  async getExpressionById(expressionId: string): Promise<Expression> {
    const knex = getKnex();
    const query = knex('expression')
      .select(['expression_id', knex.raw('operator::text AS operator')])
      .where('expression_id', expressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Expression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('expression not found', ['ExpressionRepository->getExpressionById', { expressionId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ExpressionRepository->getExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}
