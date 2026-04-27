import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyStatementConditionExpressionRepository } from '../../repositories/policy-statement-condition-expression-repository';
import { PolicyStatementConditionExpressionService } from './policy-statement-condition-expression-service';

describe('PolicyStatementConditionExpressionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('replacePolicyStatementConditionExpression', () => {
    it('ends active links and inserts the replacement link when the expression changes', async () => {
      const service = new PolicyStatementConditionExpressionService(getMockDBConnection());

      sinon
        .stub(
          PolicyStatementConditionExpressionRepository.prototype,
          'getPolicyStatementConditionExpressionsByPolicyStatementConditionId'
        )
        .resolves([
          {
            policy_statement_condition_expression_id: 'psce-1',
            policy_statement_condition_id: 'psc-1',
            expression_id: 'expr-old'
          }
        ] as any);
      const endStub = sinon
        .stub(
          PolicyStatementConditionExpressionRepository.prototype,
          'deletePolicyStatementConditionExpressionsByPolicyStatementConditionId'
        )
        .resolves([] as any);
      const insertStub = sinon
        .stub(PolicyStatementConditionExpressionRepository.prototype, 'insertPolicyStatementConditionExpression')
        .resolves({
          policy_statement_condition_expression_id: 'psce-2',
          policy_statement_condition_id: 'psc-1',
          expression_id: 'expr-new'
        } as any);

      await service.replacePolicyStatementConditionExpression('psc-1', 'expr-new');

      expect(endStub.calledOnceWithExactly('psc-1')).to.equal(true);
      expect(
        insertStub.calledOnceWithExactly({
          policy_statement_condition_id: 'psc-1',
          expression_id: 'expr-new'
        })
      ).to.equal(true);
    });
  });
});
