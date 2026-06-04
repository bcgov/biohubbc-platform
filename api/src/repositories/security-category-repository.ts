import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import {
  CreateSecurityCategory,
  SecurityCategory,
  SecurityCategoryRecord,
  SecurityCategoryWithRuleCount,
  UpdateSecurityCategory
} from '../models/security-category';
import { SecuritySearchFilters } from '../models/security-rule';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * Repository for `security_category` table CRUD operations.
 *
 * @export
 * @class SecurityCategoryRepository
 * @extends {BaseRepository}
 */
export class SecurityCategoryRepository extends BaseRepository {
  /**
   * Get all active security categories.
   *
   * @return {Promise<SecurityCategoryRecord[]>}
   * @memberof SecurityCategoryRepository
   */
  async getActiveSecurityCategories(): Promise<SecurityCategoryRecord[]> {
    const knex = getKnex();
    const query = knex.from('security_category').select('*').whereNull('record_end_date');
    const response = await this.connection.knex(query, SecurityCategoryRecord);
    return response.rows;
  }

  /**
   * Get paginated security categories with a count of associated active rules.
   *
   * @param {SecuritySearchFilters} [filters]
   * @param {ApiPaginationOptions} [pagination]
   * @return {Promise<SecurityCategoryWithRuleCount[]>}
   * @memberof SecurityCategoryRepository
   */
  async getSecurityCategoriesWithRuleCount(
    filters?: SecuritySearchFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SecurityCategoryWithRuleCount[]> {
    const knex = getKnex();

    const query = knex
      .select(
        'sc.security_category_id',
        'sc.name',
        'sc.description',
        knex.raw('COUNT(sr.security_rule_id)::integer AS rule_count')
      )
      .from('security_category as sc')
      .leftJoin('security_rule as sr', function () {
        this.on('sr.security_category_id', '=', 'sc.security_category_id').andOnNull('sr.record_end_date');
      })
      .whereNull('sc.record_end_date')
      .groupBy('sc.security_category_id', 'sc.name', 'sc.description');

    if (filters?.search) {
      query.whereILike('sc.name', `%${filters.search}%`);
    }

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, SecurityCategoryWithRuleCount);
    return response.rows;
  }

  /**
   * Get total count of active security categories matching optional filters.
   *
   * @param {SecuritySearchFilters} [filters]
   * @return {Promise<number>}
   * @memberof SecurityCategoryRepository
   */
  async getSecurityCategoriesCount(filters?: SecuritySearchFilters): Promise<number> {
    const knex = getKnex();

    const query = knex
      .select(knex.raw('count(*)::integer as count'))
      .from('security_category')
      .whereNull('record_end_date');

    if (filters?.search) {
      query.whereILike('name', `%${filters.search}%`);
    }

    const response = await this.connection.knex(query, CountResult);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get security categories count');
    }
    return response.rows[0].count;
  }

  /**
   * Insert a new security category record.
   *
   * @param {CreateSecurityCategory} data
   * @return {Promise<SecurityCategory>}
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof SecurityCategoryRepository
   */
  async insertSecurityCategory(data: CreateSecurityCategory): Promise<SecurityCategory> {
    const knex = getKnex();
    const query = knex
      .table('security_category')
      .insert({ name: data.name, description: data.description })
      .returning(['security_category_id', 'name', 'description']);

    const response = await this.connection.knex(query, SecurityCategory);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security category', [
        'SecurityCategoryRepository->insertSecurityCategory',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single active security category by ID.
   *
   * @param {number} securityCategoryId - The ID of the category to retrieve.
   * @return {Promise<SecurityCategory>}
   * @throws {ApiNotFoundError} If no active category exists for the ID.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof SecurityCategoryRepository
   */
  async getSecurityCategory(securityCategoryId: number): Promise<SecurityCategory> {
    const knex = getKnex();
    const query = knex
      .from('security_category')
      .select(['security_category_id', 'name', 'description'])
      .whereNull('record_end_date')
      .where('security_category_id', securityCategoryId);

    const response = await this.connection.knex(query, SecurityCategory);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Security category not found', [
        'SecurityCategoryRepository->getSecurityCategory',
        { securityCategoryId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SecurityCategoryRepository->getSecurityCategory',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active security category record.
   *
   * @param {number} securityCategoryId
   * @param {UpdateSecurityCategory} data
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof SecurityCategoryRepository
   */
  async updateSecurityCategory(securityCategoryId: number, data: UpdateSecurityCategory): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('security_category')
      .update({ name: data.name, description: data.description })
      .whereNull('record_end_date')
      .where('security_category_id', securityCategoryId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update security category', [
        'SecurityCategoryRepository->updateSecurityCategory',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Soft delete an active security category record.
   *
   * @param {number} securityCategoryId
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof SecurityCategoryRepository
   */
  async deleteSecurityCategory(securityCategoryId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('security_category')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('security_category_id', securityCategoryId)
      .returning(['security_category_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete security category', [
        'SecurityCategoryRepository->deleteSecurityCategory',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Count active security rules belonging to a category.
   *
   * Used by the category-delete guard to prevent deleting categories that still have active rules.
   *
   * @param {number} securityCategoryId
   * @return {Promise<number>}
   * @throws {ApiExecuteSQLError} If the count query returns an unexpected row count.
   * @memberof SecurityCategoryRepository
   */
  async getActiveSecurityRuleCountByCategory(securityCategoryId: number): Promise<number> {
    const knex = getKnex();
    const query = knex
      .select(knex.raw('count(*)::integer as count'))
      .from('security_rule')
      .whereNull('record_end_date')
      .where('security_category_id', securityCategoryId);

    const response = await this.connection.knex(query, CountResult);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get security rule count for category');
    }
    return response.rows[0].count;
  }
}
