import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiValidationError } from '../../errors/api-error';
import { PolicyStatementRepository } from '../../repositories/authorization/policy-statement-repository';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { PolicyStatementExpressionRepository } from '../../repositories/policy-statement-expression-repository';
import { PolicyStatementExpressionService } from './policy-statement-expression-service';

describe('PolicyStatementExpressionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('setPolicyStatementExpression', () => {
    it('ends active links and inserts the replacement link when the expression changes', async () => {
      const service = new PolicyStatementExpressionService(getMockDBConnection());

      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves({
        policy_statement_id: 'ps-1',
        policy_id: 'policy-1',
        effect: 'allow',
        submission_feature_urn: 'urn:*:*:*'
      } as any);
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: 'pe-new',
        policy_id: 'policy-1',
        expression_id: 'expr-new'
      });
      sinon
        .stub(PolicyStatementExpressionRepository.prototype, 'getPolicyStatementExpressionsByPolicyStatementId')
        .resolves([
          {
            policy_statement_expression_id: 'pse-1',
            policy_statement_id: 'ps-1',
            policy_expression_id: 'pe-old',
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
          policy_expression_id: 'pe-new'
        } as any);

      await service.setPolicyStatementExpression('ps-1', 'pe-new');

      expect(endStub.calledOnceWithExactly('ps-1')).to.equal(true);
      expect(
        insertStub.calledOnceWithExactly({
          policy_statement_id: 'ps-1',
          policy_expression_id: 'pe-new'
        })
      ).to.equal(true);
    });

    it('throws when the policy expression belongs to a different policy than the statement', async () => {
      const service = new PolicyStatementExpressionService(getMockDBConnection());

      sinon.stub(PolicyStatementRepository.prototype, 'getPolicyStatement').resolves({
        policy_statement_id: 'ps-1',
        policy_id: 'policy-1',
        effect: 'allow',
        submission_feature_urn: 'urn:*:*:*'
      } as any);
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionById').resolves({
        policy_expression_id: 'pe-new',
        policy_id: 'policy-2',
        expression_id: 'expr-new'
      });
      const getLinksStub = sinon.stub(
        PolicyStatementExpressionRepository.prototype,
        'getPolicyStatementExpressionsByPolicyStatementId'
      );

      try {
        await service.setPolicyStatementExpression('ps-1', 'pe-new');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiValidationError);
      }

      expect(getLinksStub).to.not.have.been.called;
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
            policy_expression_id: 'pe-1',
            expression_id: 'expr-1'
          }
        ] as any);

      const result = await service.getPolicyStatementExpressionsByPolicyStatementId('ps-1');

      expect(getStub.calledOnceWithExactly('ps-1')).to.equal(true);
      expect(result).to.eql([
        {
          policy_statement_expression_id: 'pse-1',
          policy_statement_id: 'ps-1',
          policy_expression_id: 'pe-1',
          expression_id: 'expr-1'
        }
      ]);
    });
  });
});
