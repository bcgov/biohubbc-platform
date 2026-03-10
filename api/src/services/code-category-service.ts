import { IDBConnection } from '../database/db';
import { CodeCategory, CreateCodeCategory } from '../models/code-category';
import { CodeCategoryRepository } from '../repositories/code-category-repository';
import { DBService } from './db-service';

export class CodeCategoryService extends DBService {
  codeCategoryRepository: CodeCategoryRepository;

  /**
   * Creates an instance of CodeCategoryService.
   *
   * @param {IDBConnection} connection
   * @memberof CodeCategoryService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.codeCategoryRepository = new CodeCategoryRepository(connection);
  }

  /**
   * Create a code_category row.
   *
   * @param {CreateCodeCategory} payload
   * @return {Promise<CodeCategory>}
   * @memberof CodeCategoryService
   */
  createCodeCategory(payload: CreateCodeCategory): Promise<CodeCategory> {
    return this.codeCategoryRepository.insertCodeCategory(payload);
  }

  /**
   * Get a code_category row by id.
   *
   * @param {number} codeCategoryId
   * @return {Promise<CodeCategory>}
   * @memberof CodeCategoryService
   */
  getCodeCategoryById(codeCategoryId: number): Promise<CodeCategory> {
    return this.codeCategoryRepository.getCodeCategoryById(codeCategoryId);
  }

  /**
   * Get code_category rows by contributor id.
   *
   * @param {number} contributorId
   * @return {Promise<CodeCategory[]>}
   * @memberof CodeCategoryService
   */
  getCodeCategoriesByContributorId(contributorId: number): Promise<CodeCategory[]> {
    return this.codeCategoryRepository.getCodeCategoriesByContributorId(contributorId);
  }
}
