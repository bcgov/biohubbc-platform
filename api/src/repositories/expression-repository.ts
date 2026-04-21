import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Expression, ExpressionHashRow } from '../models/expression';
import { LogicalOperator } from '../models/logical-operator';
import { BaseRepository } from './base-repository';

export class ExpressionRepository extends BaseRepository {
  /**
   * Insert an expression anchor row for a semantic expression hash.
   *
   * Uses `ON CONFLICT DO NOTHING` on the active-hash uniqueness constraint,
   * so callers can implement reuse-or-insert orchestration without transaction
   * retries for common dedupe races.
   *
   * @param {LogicalOperator} operator - Expression logical operator.
   * @param {string} expressionHash - Deterministic semantic expression hash.
   * @return {Promise<Expression | undefined>} Inserted row when created, otherwise `undefined`.
   * @throws {ApiExecuteSQLError} If insert returns an unexpected row count.
   */
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

  /**
   * Fetch one active expression anchor row by semantic hash.
   *
   * @param {string} expressionHash - Deterministic semantic expression hash.
   * @return {Promise<ExpressionHashRow | undefined>} Matching active row, when present.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   */
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

  /**
   * Fetch active expression anchors by semantic hashes.
   *
   * @param {string[]} expressionHashes - Semantic expression hashes.
   * @return {Promise<ExpressionHashRow[]>} Matching active rows.
   */
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

  /**
   * Fetch one active expression anchor row by id.
   *
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<Expression>} Matching active expression row.
   * @throws {ApiNotFoundError} If no active expression exists for the id.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   */
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
