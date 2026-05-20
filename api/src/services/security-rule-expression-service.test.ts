import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { PolicyStatementRepository } from '../repositories/authorization/policy-statement-repository';
import { SecurityRepository } from '../repositories/security-repository';
import { SecurityRuleExpressionRepository } from '../repositories/security-rule-expression-repository';
import { PolicyStatementExpressionService } from './access-policy/policy-statement-expression-service';
import { SecurityRuleExpressionService } from './security-rule-expression-service';

describe('SecurityRuleExpressionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('replaceSecurityRuleExpression', () => {
    it('ends active links and inserts the replacement link when the expression changes', async () => {
      const service = new SecurityRuleExpressionService(getMockDBConnection());

      sinon.stub(SecurityRuleExpressionRepository.prototype, 'getSecurityRuleExpressionsBySecurityRuleId').resolves([
        {
          security_rule_expression_id: 'sre-1',
          security_rule_id: 7,
          expression_id: 'expr-old'
        }
      ] as any);
      const endStub = sinon
        .stub(SecurityRuleExpressionRepository.prototype, 'deleteSecurityRuleExpressionsBySecurityRuleId')
        .resolves([] as any);
      const insertStub = sinon
        .stub(SecurityRuleExpressionRepository.prototype, 'insertSecurityRuleExpression')
        .resolves({
          security_rule_expression_id: 'sre-2',
          security_rule_id: 7,
          expression_id: 'expr-new'
        } as any);
      const getActiveRulesStub = sinon.stub(SecurityRepository.prototype, 'getActiveSecurityRules').resolves([
        {
          security_rule_id: 7,
          policy_id: '11111111-1111-1111-1111-111111111111'
        }
      ] as any);
      const getPolicyStatementsStub = sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves([
        {
          policy_statement_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '11111111-1111-1111-1111-111111111111',
          effect: 'allow',
          submission_feature_urn: 'urn:*:*:*'
        }
      ] as any);
      const replacePolicyStatementExpressionStub = sinon
        .stub(PolicyStatementExpressionService.prototype, 'replacePolicyStatementExpression')
        .resolves();

      await service.replaceSecurityRuleExpression(7, 'expr-new');

      expect(endStub.calledOnceWithExactly(7)).to.equal(true);
      expect(
        insertStub.calledOnceWithExactly({
          security_rule_id: 7,
          expression_id: 'expr-new'
        })
      ).to.equal(true);
      expect(getActiveRulesStub.calledOnce).to.equal(true);
      expect(getPolicyStatementsStub.calledOnceWithExactly('11111111-1111-1111-1111-111111111111')).to.equal(true);
      expect(
        replacePolicyStatementExpressionStub.calledOnceWithExactly('22222222-2222-2222-2222-222222222222', 'expr-new')
      ).to.equal(true);
    });
  });
});
