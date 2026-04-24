import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreateDownloadExpression, DownloadExpression } from '../models/download-expression';
import { BaseRepository } from './base-repository';

export class DownloadExpressionRepository extends BaseRepository {
  /**
   * Soft delete all active expression links for a download by setting `record_end_date`.
   *
   * @param {string} downloadId - Download identifier.
   * @return {Promise<DownloadExpression[]>} Soft-deleted download-expression rows.
   */
  async deleteDownloadExpressionsByDownloadId(downloadId: string): Promise<DownloadExpression[]> {
    const knex = getKnex();
    const query = knex('download_expression')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('download_id', downloadId)
      .whereNull('record_end_date')
      .returning(['download_expression_id', 'download_id', 'expression_id']);

    const response = await this.connection.knex(query, DownloadExpression);
    return response.rows;
  }

  /**
   * Insert a download-expression link row.
   *
   * @param {CreateDownloadExpression} payload - Download-expression payload.
   * @return {Promise<DownloadExpression>} Inserted link row.
   */
  async insertDownloadExpression(payload: CreateDownloadExpression): Promise<DownloadExpression> {
    const knex = getKnex();
    const query = knex('download_expression')
      .insert(payload)
      .returning(['download_expression_id', 'download_id', 'expression_id']);

    const response = await this.connection.knex(query, DownloadExpression);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download_expression', [
        'DownloadExpressionRepository->insertDownloadExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch one active download-expression link by id.
   *
   * @param {string} downloadExpressionId - Download-expression link identifier.
   * @return {Promise<DownloadExpression>} Matching active link row.
   */
  async getDownloadExpressionById(downloadExpressionId: string): Promise<DownloadExpression> {
    const knex = getKnex();
    const query = knex('download_expression')
      .select(['download_expression_id', 'download_id', 'expression_id'])
      .where('download_expression_id', downloadExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, DownloadExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('download_expression not found', [
        'DownloadExpressionRepository->getDownloadExpressionById',
        { downloadExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'DownloadExpressionRepository->getDownloadExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch all active expression links for a download.
   *
   * @param {string} downloadId - Download identifier.
   * @return {Promise<DownloadExpression[]>} Active download-expression links.
   */
  async getDownloadExpressionsByDownloadId(downloadId: string): Promise<DownloadExpression[]> {
    const knex = getKnex();
    const query = knex('download_expression')
      .select(['download_expression_id', 'download_id', 'expression_id'])
      .where('download_id', downloadId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, DownloadExpression);
    return response.rows;
  }

  /**
   * Fetch all active download links that reference an expression.
   *
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<DownloadExpression[]>} Active download-expression links.
   */
  async getDownloadExpressionsByExpressionId(expressionId: string): Promise<DownloadExpression[]> {
    const knex = getKnex();
    const query = knex('download_expression')
      .select(['download_expression_id', 'download_id', 'expression_id'])
      .where('expression_id', expressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, DownloadExpression);
    return response.rows;
  }
}
