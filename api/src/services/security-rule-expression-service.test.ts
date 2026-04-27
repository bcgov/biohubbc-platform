import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { SecurityRuleExpressionRepository } from '../repositories/security-rule-expression-repository';
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

      await service.replaceSecurityRuleExpression(7, 'expr-new');

      expect(endStub.calledOnceWithExactly(7)).to.equal(true);
      expect(
        insertStub.calledOnceWithExactly({
          security_rule_id: 7,
          expression_id: 'expr-new'
        })
      ).to.equal(true);
    });
  });
});
