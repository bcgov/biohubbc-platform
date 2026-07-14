import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  CreateSecurityCategory,
  SecurityCategory,
  SecurityCategoryRecord,
  SecurityCategoryWithRuleCount,
  UpdateSecurityCategory
} from '../models/security-category';
import { SecuritySearchFilters } from '../models/security-rule';
import { SecurityCategoryRepository } from '../repositories/security-category-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for `security_category` CRUD operations.
 *
 * @export
 * @class SecurityCategoryService
 * @extends {DBService}
 */
export class SecurityCategoryService extends DBService {
  securityCategoryRepository: SecurityCategoryRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.securityCategoryRepository = new SecurityCategoryRepository(connection);
  }

  /**
   * Get all active security categories.
   *
   * @return {Promise<SecurityCategoryRecord[]>}
   * @memberof SecurityCategoryService
   */
  async getActiveSecurityCategories(): Promise<SecurityCategoryRecord[]> {
    return this.securityCategoryRepository.getActiveSecurityCategories();
  }

  /**
   * Get paginated security categories with a count of associated active rules.
   *
   * @param {SecuritySearchFilters} [filters]
   * @param {ApiPaginationOptions} [pagination]
   * @return {Promise<SecurityCategoryWithRuleCount[]>}
   * @memberof SecurityCategoryService
   */
  async getSecurityCategoriesWithRuleCount(
    filters?: SecuritySearchFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SecurityCategoryWithRuleCount[]> {
    return this.securityCategoryRepository.getSecurityCategoriesWithRuleCount(filters, pagination);
  }

  /**
   * Get total count of active security categories matching optional filters.
   *
   * @param {SecuritySearchFilters} [filters]
   * @return {Promise<number>}
   * @memberof SecurityCategoryService
   */
  async getSecurityCategoriesCount(filters?: SecuritySearchFilters): Promise<number> {
    return this.securityCategoryRepository.getSecurityCategoriesCount(filters);
  }

  /**
   * Create a new security category record.
   *
   * @param {CreateSecurityCategory} data
   * @return {Promise<SecurityCategory>}
   * @memberof SecurityCategoryService
   */
  async createSecurityCategory(data: CreateSecurityCategory): Promise<SecurityCategory> {
    return this.securityCategoryRepository.insertSecurityCategory(data);
  }

  /**
   * Get a single active security category by ID.
   *
   * @param {number} securityCategoryId
   * @return {Promise<SecurityCategory>}
   * @throws {ApiNotFoundError} If no active category exists for the ID.
   * @memberof SecurityCategoryService
   */
  async getSecurityCategory(securityCategoryId: number): Promise<SecurityCategory> {
    return this.securityCategoryRepository.getSecurityCategory(securityCategoryId);
  }

  /**
   * Update a security category record by ID and return the updated record.
   *
   * @param {number} securityCategoryId
   * @param {UpdateSecurityCategory} data
   * @return {Promise<SecurityCategory>}
   * @throws {ApiNotFoundError} If no active category exists for the ID.
   * @memberof SecurityCategoryService
   */
  async updateSecurityCategory(securityCategoryId: number, data: UpdateSecurityCategory): Promise<SecurityCategory> {
    await this.securityCategoryRepository.updateSecurityCategory(securityCategoryId, data);
    return this.securityCategoryRepository.getSecurityCategory(securityCategoryId);
  }

  /**
   * Soft-delete a security category by ID.
   *
   * @param {number} securityCategoryId
   * @return {Promise<void>}
   * @throws {ApiConflictError} If the category still has active rules assigned to it.
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof SecurityCategoryService
   */
  async deleteSecurityCategory(securityCategoryId: number): Promise<void> {
    const ruleCount = await this.securityCategoryRepository.getActiveSecurityRuleCountByCategory(securityCategoryId);

    if (ruleCount > 0) {
      throw new ApiConflictError('Cannot delete a security category that has active reasons', [
        'SecurityCategoryService->deleteSecurityCategory',
        { securityCategoryId, ruleCount }
      ]);
    }

    await this.securityCategoryRepository.deleteSecurityCategory(securityCategoryId);
  }
}
