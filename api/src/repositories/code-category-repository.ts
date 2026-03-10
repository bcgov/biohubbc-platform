import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CodeCategory, CodeCategorySchema, CreateCodeCategory } from '../models/code-category';
import { BaseRepository } from './base-repository';

export class CodeCategoryRepository extends BaseRepository {
  /**
   * Insert a code_category row.
   *
   * @param {CreateCodeCategory} payload
   * @return {Promise<CodeCategory>}
   * @memberof CodeCategoryRepository
   */
  async insertCodeCategory(payload: CreateCodeCategory): Promise<CodeCategory> {
    const knex = getKnex();
    const query = knex('code_category')
      .insert(payload)
      .returning(['code_category_id', 'contributor_id', 'value', 'label', 'description', 'version']);

    const response = await this.connection.knex(query, CodeCategorySchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert code_category', [
        'CodeCategoryRepository->insertCodeCategory',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a code_category row by id.
   *
   * @param {number} codeCategoryId
   * @return {Promise<CodeCategory>}
   * @memberof CodeCategoryRepository
   */
  async getCodeCategoryById(codeCategoryId: number): Promise<CodeCategory> {
    const knex = getKnex();
    const query = knex('code_category')
      .select(['code_category_id', 'contributor_id', 'value', 'label', 'description', 'version'])
      .where('code_category_id', codeCategoryId);

    const response = await this.connection.knex(query, CodeCategorySchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('code_category not found', [
        'CodeCategoryRepository->getCodeCategoryById',
        { codeCategoryId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'CodeCategoryRepository->getCodeCategoryById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get code_category rows by contributor id.
   *
   * @param {number} contributorId
   * @return {Promise<CodeCategory[]>}
   * @memberof CodeCategoryRepository
   */
  async getCodeCategoriesByContributorId(contributorId: number): Promise<CodeCategory[]> {
    const knex = getKnex();
    const query = knex('code_category')
      .select(['code_category_id', 'contributor_id', 'value', 'label', 'description', 'version'])
      .where('contributor_id', contributorId);

    const response = await this.connection.knex(query, CodeCategorySchema);

    return response.rows;
  }
}
