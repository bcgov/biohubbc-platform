import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CountResult } from '../models/count';
import {
  CreateSecurityRule,
  SecurityRule,
  SecurityRuleAndCategory,
  SecurityRuleRecord,
  SecurityRuleWithFeatureCount,
  SecuritySearchFilters,
  UpdateSecurityRule
} from '../models/security-rule';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * Repository for `security_rule` table CRUD operations.
 *
 * @export
 * @class SecurityRuleRepository
 * @extends {BaseRepository}
 */
export class SecurityRuleRepository extends BaseRepository {
  /**
   * Gets a list of all active security rules. A security rule is active if it has not been end-dated.
   *
   * @return {Promise<SecurityRuleRecord[]>}
   * @memberof SecurityRuleRepository
   */
  async getActiveSecurityRules(): Promise<SecurityRuleRecord[]> {
    const sql = SQL`
      SELECT
        security_rule_id,
        policy_id,
        name,
        description,
        is_active,
        record_effective_date,
        record_end_date,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count
      FROM security_rule
      WHERE record_end_date IS NULL;
    `;
    const response = await this.connection.sql(sql, SecurityRuleRecord);
    return response.rows;
  }

  /**
   * Gets security rules eligible for automatic screening.
   * A rule is screenable when it is not soft-deleted and is_active is true.
   *
   * Future automatic screening must use this method (not getActiveSecurityRules).
   *
   * @return {Promise<SecurityRuleRecord[]>}
   * @memberof SecurityRuleRepository
   */
  async getScreenableSecurityRules(): Promise<SecurityRuleRecord[]> {
    const sql = SQL`
      SELECT
        security_rule_id,
        policy_id,
        name,
        description,
        is_active,
        record_effective_date,
        record_end_date,
        create_date,
        create_user,
        update_date,
        update_user,
        revision_count
      FROM security_rule
      WHERE record_end_date IS NULL
        AND is_active = true;
    `;
    const response = await this.connection.sql(sql, SecurityRuleRecord);
    return response.rows;
  }

  /**
   * Gets a list of all active security rules with their associated categories.
   *
   * @return {Promise<SecurityRuleAndCategory[]>}
   * @memberof SecurityRuleRepository
   */
  async getActiveRulesAndCategories(): Promise<SecurityRuleAndCategory[]> {
    const sql = SQL`
      SELECT 
        sr.security_rule_id,
        sr.policy_id,
        sr.name,
        sr.description,
        sr.is_active,
        sr.record_effective_date,
        sr.record_end_date,
        sc.security_category_id,
        sc.name as category_name,
        sc.description as category_description,
        sc.record_effective_date as category_record_effective_date,
        sc.record_end_date as category_record_end_date
      FROM security_rule sr, security_category sc 
      WHERE sr.security_category_id = sc.security_category_id
      AND sr.record_end_date IS NULL;
    `;
    const response = await this.connection.sql(sql, SecurityRuleAndCategory);
    return response.rows;
  }

  /**
   * Get paginated security rules with a count of associated active submission features.
   * Only active (non-soft-deleted) applications are counted.
   *
   * @param {SecuritySearchFilters} [filters]
   * @param {ApiPaginationOptions} [pagination]
   * @return {Promise<SecurityRuleWithFeatureCount[]>}
   * @memberof SecurityRuleRepository
   */
  async getSecurityRulesWithFeatureCount(
    filters?: SecuritySearchFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SecurityRuleWithFeatureCount[]> {
    const knex = getKnex();

    const query = knex
      .select(
        'sr.security_rule_id',
        'sr.security_category_id',
        'sc.name as category_name',
        'sr.name',
        'sr.description',
        'sr.is_active',
        knex.raw('COUNT(sfs.submission_feature_security_id)::integer AS feature_count')
      )
      .from('security_rule as sr')
      .innerJoin('security_category as sc', function () {
        this.on('sr.security_category_id', '=', 'sc.security_category_id').andOnNull('sc.record_end_date');
      })
      .leftJoin('submission_feature_security as sfs', function () {
        this.on('sfs.security_rule_id', '=', 'sr.security_rule_id').andOnNull('sfs.record_end_date');
      })
      .whereNull('sr.record_end_date')
      .groupBy(
        'sr.security_rule_id',
        'sr.security_category_id',
        'sc.name',
        'sr.name',
        'sr.description',
        'sr.is_active'
      );

    if (filters?.search) {
      query.whereILike('sr.name', `%${filters.search}%`);
    }

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    const response = await this.connection.knex(query, SecurityRuleWithFeatureCount);
    return response.rows;
  }

  /**
   * Get total count of active security rules matching optional filters.
   *
   * @param {SecuritySearchFilters} [filters]
   * @return {Promise<number>}
   * @throws {ApiExecuteSQLError} If the count query returns an unexpected row count.
   * @memberof SecurityRuleRepository
   */
  async getSecurityRulesCount(filters?: SecuritySearchFilters): Promise<number> {
    const knex = getKnex();

    const query = knex
      .select(knex.raw('count(*)::integer as count'))
      .from('security_rule')
      .whereNull('record_end_date');

    if (filters?.search) {
      query.whereILike('name', `%${filters.search}%`);
    }

    const response = await this.connection.knex(query, CountResult);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get security rules count');
    }
    return response.rows[0].count;
  }

  /**
   * Insert a new security rule record.
   *
   * @param {CreateSecurityRule} data
   * @return {Promise<SecurityRule>}
   * @throws {ApiExecuteSQLError} If the insert does not affect exactly one row.
   * @memberof SecurityRuleRepository
   */
  async insertSecurityRule(data: CreateSecurityRule): Promise<SecurityRule> {
    const knex = getKnex();
    const insertData = {
      security_category_id: data.security_category_id,
      name: data.name,
      description: data.description,
      is_active: data.is_active,
      policy_id: null
    };

    const query = knex
      .table('security_rule')
      .insert(insertData)
      .returning(['security_rule_id', 'security_category_id', 'name', 'description', 'is_active']);

    const response = await this.connection.knex(query, SecurityRule);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security rule', [
        'SecurityRuleRepository->insertSecurityRule',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a single active security rule by ID.
   *
   * @param {number} securityRuleId - The ID of the rule to retrieve.
   * @return {Promise<SecurityRule>}
   * @throws {ApiNotFoundError} If no active rule exists for the ID.
   * @throws {ApiExecuteSQLError} If an unexpected row count is returned.
   * @memberof SecurityRuleRepository
   */
  async getSecurityRule(securityRuleId: number): Promise<SecurityRule> {
    const knex = getKnex();
    const query = knex
      .from('security_rule')
      .select(['security_rule_id', 'security_category_id', 'name', 'description', 'is_active'])
      .whereNull('record_end_date')
      .where('security_rule_id', securityRuleId);

    const response = await this.connection.knex(query, SecurityRule);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Security rule not found', [
        'SecurityRuleRepository->getSecurityRule',
        { securityRuleId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SecurityRuleRepository->getSecurityRule',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an active security rule record.
   *
   * @param {number} securityRuleId
   * @param {UpdateSecurityRule} data
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the update does not affect exactly one row.
   * @memberof SecurityRuleRepository
   */
  async updateSecurityRule(securityRuleId: number, data: UpdateSecurityRule): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('security_rule')
      .update({
        security_category_id: data.security_category_id,
        name: data.name,
        description: data.description,
        is_active: data.is_active
      })
      .whereNull('record_end_date')
      .where('security_rule_id', securityRuleId);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update security rule', [
        'SecurityRuleRepository->updateSecurityRule',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Soft delete an active security rule record.
   *
   * @param {number} securityRuleId
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} If the delete does not affect exactly one row.
   * @memberof SecurityRuleRepository
   */
  async deleteSecurityRule(securityRuleId: number): Promise<void> {
    const knex = getKnex();
    const query = knex
      .table('security_rule')
      .update({ record_end_date: knex.fn.now() })
      .whereNull('record_end_date')
      .where('security_rule_id', securityRuleId)
      .returning(['security_rule_id']);

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete security rule', [
        'SecurityRuleRepository->deleteSecurityRule',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Count how many active (non-soft-deleted) `submission_feature_security` records reference the given rule.
   *
   * Used by the rule-delete guard to prevent deleting rules that are still applied to features.
   *
   * @param {number} securityRuleId
   * @return {Promise<number>}
   * @throws {ApiExecuteSQLError} If the count query returns an unexpected row count.
   * @memberof SecurityRuleRepository
   */
  async getActiveAppliedFeatureCount(securityRuleId: number): Promise<number> {
    const knex = getKnex();
    const query = knex
      .select(knex.raw('count(*)::integer as count'))
      .from('submission_feature_security')
      .where('security_rule_id', securityRuleId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, CountResult);
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get active applied feature count for security rule');
    }
    return response.rows[0].count;
  }
}
