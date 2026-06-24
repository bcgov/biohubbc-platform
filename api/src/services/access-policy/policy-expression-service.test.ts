import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { PolicyExpressionService } from './policy-expression-service';

describe('PolicyExpressionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ensurePolicyExpression', () => {
    it('delegates to repository with policy and expression ids', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());

      const policyExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      };

      const ensureStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'ensurePolicyExpression')
        .resolves(policyExpression);

      const result = await service.ensurePolicyExpression({
        policyId: 'policy-1',
        expressionId: 'expr-1'
      });

      expect(result).to.eql(policyExpression);
      expect(ensureStub).to.have.been.calledOnceWithExactly({
        policyId: 'policy-1',
        expressionId: 'expr-1'
      });
    });

    it('delegates metadata to repository when provided', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());

      const policyExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: 'Named expression',
        description: 'Useful expression'
      };

      const ensureStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'ensurePolicyExpression')
        .resolves(policyExpression);

      const result = await service.ensurePolicyExpression({
        policyId: 'policy-1',
        expressionId: 'expr-1',
        name: 'Named expression',
        description: 'Useful expression'
      });

      expect(result).to.eql(policyExpression);
      expect(ensureStub).to.have.been.calledOnceWithExactly({
        policyId: 'policy-1',
        expressionId: 'expr-1',
        name: 'Named expression',
        description: 'Useful expression'
      });
    });
  });

  describe('getPolicyExpressionById', () => {
    it('delegates to repository', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());

      const policyExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      };

      const getStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionById')
        .resolves(policyExpression);

      const result = await service.getPolicyExpressionById('pe-1');

      expect(result).to.eql(policyExpression);
      expect(getStub).to.have.been.calledOnceWithExactly('pe-1');
    });
  });
});
