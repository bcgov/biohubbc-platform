import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreateSecurityRuleExpression, SecurityRuleExpression } from '../models/security-rule-expression';
import { BaseRepository } from './base-repository';

export class SecurityRuleExpressionRepository extends BaseRepository {
  /**
   * Soft delete all active expression links for a security rule by setting `record_end_date`.
   *
   * @param {number} securityRuleId - Security rule identifier.
   * @return {Promise<SecurityRuleExpression[]>} Soft-deleted link rows.
   */
  async deleteSecurityRuleExpressionsBySecurityRuleId(securityRuleId: number): Promise<SecurityRuleExpression[]> {
    const knex = getKnex();
    const query = knex('security_rule_expression')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('security_rule_id', securityRuleId)
      .whereNull('record_end_date')
      .returning(['security_rule_expression_id', 'security_rule_id', 'expression_id']);

    const response = await this.connection.knex(query, SecurityRuleExpression);
    return response.rows;
  }

  /**
   * Insert a security-rule-to-expression link row.
   *
   * @param {CreateSecurityRuleExpression} payload - Security-rule expression payload.
   * @return {Promise<SecurityRuleExpression>} Inserted link row.
   */
  async insertSecurityRuleExpression(payload: CreateSecurityRuleExpression): Promise<SecurityRuleExpression> {
    const knex = getKnex();
    const query = knex('security_rule_expression')
      .insert(payload)
      .returning(['security_rule_expression_id', 'security_rule_id', 'expression_id']);

    const response = await this.connection.knex(query, SecurityRuleExpression);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security_rule_expression', [
        'SecurityRuleExpressionRepository->insertSecurityRuleExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch one active security-rule-expression link by id.
   *
   * @param {string} securityRuleExpressionId - Security-rule-expression link identifier.
   * @return {Promise<SecurityRuleExpression>} Matching active link row.
   */
  async getSecurityRuleExpressionById(securityRuleExpressionId: string): Promise<SecurityRuleExpression> {
    const knex = getKnex();
    const query = knex('security_rule_expression')
      .select(['security_rule_expression_id', 'security_rule_id', 'expression_id'])
      .where('security_rule_expression_id', securityRuleExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, SecurityRuleExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('security_rule_expression not found', [
        'SecurityRuleExpressionRepository->getSecurityRuleExpressionById',
        { securityRuleExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SecurityRuleExpressionRepository->getSecurityRuleExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Fetch all active expression links for a security rule.
   *
   * @param {number} securityRuleId - Security rule identifier.
   * @return {Promise<SecurityRuleExpression[]>} Active link rows.
   */
  async getSecurityRuleExpressionsBySecurityRuleId(securityRuleId: number): Promise<SecurityRuleExpression[]> {
    const knex = getKnex();
    const query = knex('security_rule_expression')
      .select(['security_rule_expression_id', 'security_rule_id', 'expression_id'])
      .where('security_rule_id', securityRuleId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, SecurityRuleExpression);
    return response.rows;
  }

  /**
   * Fetch all active security-rule links that reference an expression.
   *
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<SecurityRuleExpression[]>} Active link rows.
   */
  async getSecurityRuleExpressionsByExpressionId(expressionId: string): Promise<SecurityRuleExpression[]> {
    const knex = getKnex();
    const query = knex('security_rule_expression')
      .select(['security_rule_expression_id', 'security_rule_id', 'expression_id'])
      .where('expression_id', expressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, SecurityRuleExpression);
    return response.rows;
  }
}
