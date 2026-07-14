import { IDBConnection } from '../database/db';
import { ApiConflictError } from '../errors/api-error';
import {
  CreateSecurityRule,
  SecurityRule,
  SecurityRuleAndCategory,
  SecurityRuleRecord,
  SecurityRuleWithFeatureCount,
  SecuritySearchFilters,
  UpdateSecurityRule
} from '../models/security-rule';
import { SecurityCategoryRepository } from '../repositories/security-category-repository';
import { SecurityRuleRepository } from '../repositories/security-rule-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';

/**
 * Service for `security_rule` CRUD operations.
 *
 * @export
 * @class SecurityRuleService
 * @extends {DBService}
 */
export class SecurityRuleService extends DBService {
  securityRuleRepository: SecurityRuleRepository;
  securityCategoryRepository: SecurityCategoryRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.securityRuleRepository = new SecurityRuleRepository(connection);
    this.securityCategoryRepository = new SecurityCategoryRepository(connection);
  }

  /**
   * Gets a list of all active security rules.
   *
   * @return {Promise<SecurityRuleRecord[]>}
   * @memberof SecurityRuleService
   */
  async getActiveSecurityRules(): Promise<SecurityRuleRecord[]> {
    return this.securityRuleRepository.getActiveSecurityRules();
  }

  /**
   * Gets security rules eligible for automatic screening.
   *
   * A rule is screenable when it is not soft-deleted (`record_end_date IS NULL`) and
   * `is_active = true`. Use this — not `getActiveSecurityRules` — when running
   * automatic security screening so that admins can opt individual rules out of
   * screening without soft-deleting them.
   *
   * @return {Promise<SecurityRuleRecord[]>}
   * @memberof SecurityRuleService
   */
  async getScreenableSecurityRules(): Promise<SecurityRuleRecord[]> {
    return this.securityRuleRepository.getScreenableSecurityRules();
  }

  /**
   * Gets a list of all active security rules with their associated categories.
   *
   * @return {Promise<SecurityRuleAndCategory[]>}
   * @memberof SecurityRuleService
   */
  async getActiveRulesAndCategories(): Promise<SecurityRuleAndCategory[]> {
    return this.securityRuleRepository.getActiveRulesAndCategories();
  }

  /**
   * Get paginated security rules with a count of associated active submission features.
   *
   * @param {SecuritySearchFilters} [filters]
   * @param {ApiPaginationOptions} [pagination]
   * @return {Promise<SecurityRuleWithFeatureCount[]>}
   * @memberof SecurityRuleService
   */
  async getSecurityRulesWithFeatureCount(
    filters?: SecuritySearchFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SecurityRuleWithFeatureCount[]> {
    return this.securityRuleRepository.getSecurityRulesWithFeatureCount(filters, pagination);
  }

  /**
   * Get total count of active security rules matching optional filters.
   *
   * @param {SecuritySearchFilters} [filters]
   * @return {Promise<number>}
   * @memberof SecurityRuleService
   */
  async getSecurityRulesCount(filters?: SecuritySearchFilters): Promise<number> {
    return this.securityRuleRepository.getSecurityRulesCount(filters);
  }

  /**
   * Create a new security rule record. Validates that the referenced category exists first.
   *
   * @param {CreateSecurityRule} data
   * @return {Promise<SecurityRule>}
   * @throws {ApiNotFoundError} If the referenced security category does not exist.
   * @memberof SecurityRuleService
   */
  async createSecurityRule(data: CreateSecurityRule): Promise<SecurityRule> {
    await this.securityCategoryRepository.getSecurityCategory(data.security_category_id);
    return this.securityRuleRepository.insertSecurityRule(data);
  }

  /**
   * Get a single active security rule by ID.
   *
   * @param {number} securityRuleId
   * @return {Promise<SecurityRule>}
   * @throws {ApiNotFoundError} If no active rule exists for the ID.
   * @memberof SecurityRuleService
   */
  async getSecurityRule(securityRuleId: number): Promise<SecurityRule> {
    return this.securityRuleRepository.getSecurityRule(securityRuleId);
  }

  /**
   * Update a security rule record by ID and return the updated record.
   * Validates that the referenced category exists before updating.
   *
   * @param {number} securityRuleId
   * @param {UpdateSecurityRule} data
   * @return {Promise<SecurityRule>}
   * @throws {ApiNotFoundError} If the referenced category or rule does not exist.
   * @memberof SecurityRuleService
   */
  async updateSecurityRule(securityRuleId: number, data: UpdateSecurityRule): Promise<SecurityRule> {
    await this.securityCategoryRepository.getSecurityCategory(data.security_category_id);
    await this.securityRuleRepository.updateSecurityRule(securityRuleId, data);
    return this.securityRuleRepository.getSecurityRule(securityRuleId);
  }

  /**
   * Assert that the security rule is not actively applied to any submission features. Throws if it is.
   *
   * @param {number} securityRuleId
   * @return {Promise<void>}
   * @throws {ApiConflictError} If the rule is still applied to one or more features.
   * @memberof SecurityRuleService
   */
  async assertSecurityRuleIsUnused(securityRuleId: number): Promise<void> {
    const count = await this.securityRuleRepository.getActiveAppliedFeatureCount(securityRuleId);

    if (count > 0) {
      throw new ApiConflictError('Cannot delete a security rule that is still applied to one or more features', [
        'SecurityRuleService->assertSecurityRuleIsUnused',
        { securityRuleId, count }
      ]);
    }
  }

  /**
   * Soft-delete a security rule by ID.
   *
   * @param {number} securityRuleId
   * @return {Promise<void>}
   * @throws {ApiConflictError} If the rule is still applied to one or more features.
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof SecurityRuleService
   */
  async deleteSecurityRule(securityRuleId: number): Promise<void> {
    await this.assertSecurityRuleIsUnused(securityRuleId);
    await this.securityRuleRepository.deleteSecurityRule(securityRuleId);
  }
}
