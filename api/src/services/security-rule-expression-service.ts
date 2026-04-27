import { IDBConnection } from '../database/db';
import { SecurityRuleExpressionRepository } from '../repositories/security-rule-expression-repository';
import { DBService } from './db-service';

export class SecurityRuleExpressionService extends DBService {
  securityRuleExpressionRepository: SecurityRuleExpressionRepository;

  /**
   * Build a security-rule expression service.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.securityRuleExpressionRepository = new SecurityRuleExpressionRepository(connection);
  }

  /**
   * Repoint a security rule to the provided expression.
   *
   * Behavior:
   * 1. Load active security-rule links.
   * 2. Return early when already linked to the requested expression.
   * 3. Soft-delete existing links when the target changes.
   * 4. Insert the replacement active link.
   *
   * @param {number} securityRuleId - Security rule identifier.
   * @param {string} expressionId - Expression identifier.
   * @return {Promise<void>} Resolves once the link points to `expressionId`.
   */
  async replaceSecurityRuleExpression(securityRuleId: number, expressionId: string): Promise<void> {
    const existingLinks = await this.securityRuleExpressionRepository.getSecurityRuleExpressionsBySecurityRuleId(
      securityRuleId
    );
    const alreadyLinked = existingLinks.length === 1 && existingLinks[0].expression_id === expressionId;

    if (alreadyLinked) {
      return;
    }

    if (existingLinks.length > 0) {
      await this.securityRuleExpressionRepository.deleteSecurityRuleExpressionsBySecurityRuleId(securityRuleId);
    }

    await this.securityRuleExpressionRepository.insertSecurityRuleExpression({
      security_rule_id: securityRuleId,
      expression_id: expressionId
    });
  }
}
