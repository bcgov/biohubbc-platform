import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyStatementExpressionRepository } from '../../repositories/policy-statement-expression-repository';
import { PolicyStatementExpressionService } from './policy-statement-expression-service';

describe('PolicyStatementExpressionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('replacePolicyStatementExpression', () => {
    it('ends active links and inserts the replacement link when the expression changes', async () => {
      const service = new PolicyStatementExpressionService(getMockDBConnection());

      sinon
        .stub(PolicyStatementExpressionRepository.prototype, 'getPolicyStatementExpressionsByPolicyStatementId')
        .resolves([
          {
            policy_statement_expression_id: 'pse-1',
            policy_statement_id: 'ps-1',
            expression_id: 'expr-old'
          }
        ] as any);
      const endStub = sinon
        .stub(PolicyStatementExpressionRepository.prototype, 'deletePolicyStatementExpressionsByPolicyStatementId')
        .resolves([] as any);
      const insertStub = sinon
        .stub(PolicyStatementExpressionRepository.prototype, 'insertPolicyStatementExpression')
        .resolves({
          policy_statement_expression_id: 'pse-2',
          policy_statement_id: 'ps-1',
          expression_id: 'expr-new'
        } as any);

      await service.replacePolicyStatementExpression('ps-1', 'expr-new');

      expect(endStub.calledOnceWithExactly('ps-1')).to.equal(true);
      expect(
        insertStub.calledOnceWithExactly({
          policy_statement_id: 'ps-1',
          expression_id: 'expr-new'
        })
      ).to.equal(true);
    });
  });

  describe('getPolicyStatementExpressionsByPolicyStatementId', () => {
    it('returns active expression links for the statement', async () => {
      const service = new PolicyStatementExpressionService(getMockDBConnection());
      const getStub = sinon
        .stub(PolicyStatementExpressionRepository.prototype, 'getPolicyStatementExpressionsByPolicyStatementId')
        .resolves([
          {
            policy_statement_expression_id: 'pse-1',
            policy_statement_id: 'ps-1',
            expression_id: 'expr-1'
          }
        ] as any);

      const result = await service.getPolicyStatementExpressionsByPolicyStatementId('ps-1');

      expect(getStub.calledOnceWithExactly('ps-1')).to.equal(true);
      expect(result).to.eql([
        {
          policy_statement_expression_id: 'pse-1',
          policy_statement_id: 'ps-1',
          expression_id: 'expr-1'
        }
      ]);
    });
  });
});
