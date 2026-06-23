import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Expression, ResolvedExpressionAnchor } from '../models/expression';
import { LogicalOperator } from '../models/logical-operator';
import { BaseRepository } from './base-repository';

export class ExpressionRepository extends BaseRepository {
  /**
   * Insert an expression anchor row for a semantic expression hash.
   *
   * Callers are expected to pre-read by hash and reuse existing anchors. The
   * active-hash uniqueness constraint remains the final guard for concurrent
   * duplicate writes.
   *
   * @param {LogicalOperator} operator - Expression logical operator.
   * @param {string} expressionHash - Deterministic semantic expression hash.
   * @return {Promise<ResolvedExpressionAnchor>} Resolved expression row with insert-state flag.
   * @throws {ApiExecuteSQLError} If insert returns an unexpected row count.
   */
  async insertExpressionAnchor(operator: LogicalOperator, expressionHash: string): Promise<ResolvedExpressionAnchor> {
    const knex = getKnex();
    const query = knex('expression')
      .insert({
        operator,
        expression_hash: expressionHash
      })
      .returning([
        'expression_id',
        knex.raw('operator::text AS operator'),
        'expression_hash',
        knex.raw('true AS inserted')
      ]);

    const response = await this.connection.knex(query, ResolvedExpressionAnchor);
    const rowCount = response.rowCount ?? 0;

    if (rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert expression anchor', [
        'ExpressionRepository->insertExpressionAnchor',
        `rowCount was ${rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Find one active expression anchor row by semantic hash.
   *
   * @param {string} expressionHash - Deterministic semantic expression hash.
   * @return {Promise<Expression | null>} Matching active row, when present.
   * @throws {ApiExecuteSQLError} If more than one active row is returned.
   */
  async findExpressionByHash(expressionHash: string): Promise<Expression | null> {
    const knex = getKnex();
    const query = knex('expression')
      .select(['expression_id', knex.raw('operator::text AS operator'), 'expression_hash'])
      .where('expression_hash', expressionHash)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Expression);
    const rowCount = response.rowCount ?? 0;

    if (rowCount > 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ExpressionRepository->findExpressionByHash',
        `expected rowCount=0|1, actual rowCount=${rowCount}`
      ]);
    }

    return response.rows[0] ?? null;
  }

  /**
   * Fetch active expression anchors by semantic hashes.
   *
   * @param {string[]} expressionHashes - Semantic expression hashes.
   * @return {Promise<Expression[]>} Matching active rows.
   */
  async getExpressionsByHashes(expressionHashes: string[]): Promise<Expression[]> {
    if (expressionHashes.length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = knex('expression')
      .select(['expression_id', knex.raw('operator::text AS operator'), 'expression_hash'])
      .whereIn('expression_hash', [...new Set(expressionHashes)])
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, Expression);
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
      .select(['expression_id', knex.raw('operator::text AS operator'), 'expression_hash'])
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
