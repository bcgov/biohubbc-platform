import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Code, CodeSchema, CreateCode } from '../models/code';
import { BaseRepository } from './base-repository';

export class CodeTableRepository extends BaseRepository {
  /**
   * Insert a code row.
   *
   * @param {CreateCode} payload
   * @return {Promise<Code>}
   * @memberof CodeTableRepository
   */
  async insertCode(payload: CreateCode): Promise<Code> {
    const knex = getKnex();
    const query = knex('code')
      .insert(payload)
      .returning(['code_id', 'code_category_id', 'value', 'label', 'description', 'version']);

    const response = await this.connection.knex(query, CodeSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert code', [
        'CodeTableRepository->insertCode',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a code row by id.
   *
   * @param {number} codeId
   * @return {Promise<Code>}
   * @memberof CodeTableRepository
   */
  async getCodeById(codeId: number): Promise<Code> {
    const knex = getKnex();
    const query = knex('code')
      .select(['code_id', 'code_category_id', 'value', 'label', 'description', 'version'])
      .where('code_id', codeId);

    const response = await this.connection.knex(query, CodeSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('code not found', ['CodeTableRepository->getCodeById', { codeId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'CodeTableRepository->getCodeById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get code rows by code_category_id.
   *
   * @param {number} codeCategoryId
   * @return {Promise<Code[]>}
   * @memberof CodeTableRepository
   */
  async getCodesByCodeCategoryId(codeCategoryId: number): Promise<Code[]> {
    const knex = getKnex();
    const query = knex('code')
      .select(['code_id', 'code_category_id', 'value', 'label', 'description', 'version'])
      .where('code_category_id', codeCategoryId);

    const response = await this.connection.knex(query, CodeSchema);

    return response.rows;
  }
}
