import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { PolicyStatementRepository } from '../repositories/authorization/policy-statement-repository';
import { SecurityRuleExpressionRepository } from '../repositories/security-rule-expression-repository';
import { SecurityRuleRepository } from '../repositories/security-rule-repository';
import { PolicyExpressionService } from './access-policy/policy-expression-service';
import { PolicyStatementService } from './access-policy/policy-statement-service';
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
      const getActiveRulesStub = sinon.stub(SecurityRuleRepository.prototype, 'getActiveSecurityRules').resolves([
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
      const updatePolicyStatementStub = sinon
        .stub(PolicyStatementService.prototype, 'updatePolicyStatement')
        .resolves();
      const ensurePolicyExpressionStub = sinon
        .stub(PolicyExpressionService.prototype, 'ensurePolicyExpression')
        .resolves({
          policy_expression_id: '33333333-3333-3333-3333-333333333333',
          policy_id: '11111111-1111-1111-1111-111111111111',
          expression_id: 'expr-new',
          name: null,
          description: null
        });

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
        ensurePolicyExpressionStub.calledOnceWithExactly({
          policyId: '11111111-1111-1111-1111-111111111111',
          expressionId: 'expr-new'
        })
      ).to.equal(true);
      expect(
        updatePolicyStatementStub.calledOnceWithExactly('22222222-2222-2222-2222-222222222222', {
          policy_expression_id: '33333333-3333-3333-3333-333333333333'
        })
      ).to.equal(true);
    });

    it('still syncs policy expression when security rule expression is already linked', async () => {
      const service = new SecurityRuleExpressionService(getMockDBConnection());

      sinon.stub(SecurityRuleExpressionRepository.prototype, 'getSecurityRuleExpressionsBySecurityRuleId').resolves([
        {
          security_rule_expression_id: 'sre-1',
          security_rule_id: 7,
          expression_id: 'expr-current'
        }
      ] as any);
      const endStub = sinon
        .stub(SecurityRuleExpressionRepository.prototype, 'deleteSecurityRuleExpressionsBySecurityRuleId')
        .resolves([] as any);
      const insertStub = sinon
        .stub(SecurityRuleExpressionRepository.prototype, 'insertSecurityRuleExpression')
        .resolves({} as any);
      sinon.stub(SecurityRuleRepository.prototype, 'getActiveSecurityRules').resolves([
        {
          security_rule_id: 7,
          policy_id: '11111111-1111-1111-1111-111111111111'
        }
      ] as any);
      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatements').resolves([
        {
          policy_statement_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '11111111-1111-1111-1111-111111111111',
          effect: 'allow',
          submission_feature_urn: 'urn:*:*:*'
        }
      ] as any);
      const updatePolicyStatementStub = sinon
        .stub(PolicyStatementService.prototype, 'updatePolicyStatement')
        .resolves();
      const ensurePolicyExpressionStub = sinon
        .stub(PolicyExpressionService.prototype, 'ensurePolicyExpression')
        .resolves({
          policy_expression_id: '33333333-3333-3333-3333-333333333333',
          policy_id: '11111111-1111-1111-1111-111111111111',
          expression_id: 'expr-current',
          name: null,
          description: null
        });

      await service.replaceSecurityRuleExpression(7, 'expr-current');

      expect(endStub.called).to.equal(false);
      expect(insertStub.called).to.equal(false);
      expect(
        ensurePolicyExpressionStub.calledOnceWithExactly({
          policyId: '11111111-1111-1111-1111-111111111111',
          expressionId: 'expr-current'
        })
      ).to.equal(true);
      expect(
        updatePolicyStatementStub.calledOnceWithExactly('22222222-2222-2222-2222-222222222222', {
          policy_expression_id: '33333333-3333-3333-3333-333333333333'
        })
      ).to.equal(true);
    });

    it('skips policy synchronization when active rule has no policy_id', async () => {
      const service = new SecurityRuleExpressionService(getMockDBConnection());

      sinon.stub(SecurityRuleExpressionRepository.prototype, 'getSecurityRuleExpressionsBySecurityRuleId').resolves([
        {
          security_rule_expression_id: 'sre-1',
          security_rule_id: 7,
          expression_id: 'expr-old'
        }
      ] as any);
      sinon
        .stub(SecurityRuleExpressionRepository.prototype, 'deleteSecurityRuleExpressionsBySecurityRuleId')
        .resolves([] as any);
      sinon.stub(SecurityRuleExpressionRepository.prototype, 'insertSecurityRuleExpression').resolves({
        security_rule_expression_id: 'sre-2',
        security_rule_id: 7,
        expression_id: 'expr-new'
      } as any);
      sinon.stub(SecurityRuleRepository.prototype, 'getActiveSecurityRules').resolves([
        {
          security_rule_id: 7,
          policy_id: null
        }
      ] as any);
      const getPolicyStatementsStub = sinon
        .stub(PolicyStatementRepository.prototype, 'getPolicyStatements')
        .resolves([] as any);
      const updatePolicyStatementStub = sinon
        .stub(PolicyStatementService.prototype, 'updatePolicyStatement')
        .resolves();

      await service.replaceSecurityRuleExpression(7, 'expr-new');

      expect(getPolicyStatementsStub.called).to.equal(false);
      expect(updatePolicyStatementStub.called).to.equal(false);
    });
  });
});
