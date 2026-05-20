import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { PolicyEffect } from '../models/policy-statement';
import { PolicyStatementRepository } from '../repositories/authorization/policy-statement-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { SecurityRuleExpressionRepository } from '../repositories/security-rule-expression-repository';
import { PolicyStatementExpressionService } from './access-policy/policy-statement-expression-service';
import { DBService } from './db-service';

export class SecurityRuleExpressionService extends DBService {
  securityRuleExpressionRepository: SecurityRuleExpressionRepository;
  securityRepository: SecurityRepository;
  policyStatementRepository: PolicyStatementRepository;
  policyStatementExpressionService: PolicyStatementExpressionService;

  /**
   * Build a security-rule expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.securityRuleExpressionRepository = new SecurityRuleExpressionRepository(connection);
    this.securityRepository = new SecurityRepository(connection);
    this.policyStatementRepository = new PolicyStatementRepository(connection);
    this.policyStatementExpressionService = new PolicyStatementExpressionService(connection);
  }

  /**
   * Repoint a security rule to the provided expression.
   *
   * Behavior:
   * 1. Load active security-rule links.
   * 2. Soft-delete existing links when the target changes.
   * 3. Insert the replacement active link when needed.
   * 4. Synchronize the mapped `urn:*:*:*` ALLOW policy statement expression link.
   *
   * Notes:
   * - Policy synchronization runs regardless of whether the security-rule link was already correct.
   * - If the active security rule has no `policy_id`, synchronization is skipped.
   *
   * @param {number} securityRuleId - Security rule identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<void>} Resolves once the link points to `expressionId`.
   * @memberof SecurityRuleExpressionService
   */
  async replaceSecurityRuleExpression(securityRuleId: number, expressionId: string): Promise<void> {
    const existingLinks = await this.securityRuleExpressionRepository.getSecurityRuleExpressionsBySecurityRuleId(
      securityRuleId
    );
    const alreadyLinked = existingLinks.length === 1 && existingLinks[0].expression_id === expressionId;

    if (!alreadyLinked && existingLinks.length > 0) {
      await this.securityRuleExpressionRepository.deleteSecurityRuleExpressionsBySecurityRuleId(securityRuleId);
    }

    if (!alreadyLinked) {
      await this.securityRuleExpressionRepository.insertSecurityRuleExpression({
        security_rule_id: securityRuleId,
        expression_id: expressionId
      });
    }

    const securityRule = await this.getActiveSecurityRuleById(securityRuleId);

    if (!securityRule.policy_id) {
      return;
    }

    const policyStatements = await this.policyStatementRepository.getPolicyStatements(securityRule.policy_id);
    const mappedStatement = policyStatements.find(
      (statement) => statement.effect === PolicyEffect.ALLOW && statement.submission_feature_urn === 'urn:*:*:*'
    );

    if (!mappedStatement) {
      throw new ApiExecuteSQLError('No mapped policy statement found for security rule policy');
    }

    await this.policyStatementExpressionService.replacePolicyStatementExpression(
      mappedStatement.policy_statement_id,
      expressionId
    );
  }

  /**
   * Resolve one active security rule by id.
   *
   * @param {number} securityRuleId - Security rule identifier.
   * @return {Promise<{ policy_id: string | null }>} Active rule projection with policy linkage.
   * @memberof SecurityRuleExpressionService
   */
  private async getActiveSecurityRuleById(securityRuleId: number): Promise<{ policy_id: string | null }> {
    const activeRules = await this.securityRepository.getActiveSecurityRules();
    const activeRule = activeRules.find((rule) => rule.security_rule_id === securityRuleId);

    if (!activeRule) {
      throw new ApiExecuteSQLError('Active security rule not found for expression update');
    }

    return activeRule;
  }
}
