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
    it('returns existing policy expression when active row exists', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const existing = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      };
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves(existing);
      const insertStub = sinon.stub(PolicyExpressionRepository.prototype, 'insertPolicyExpression');

      const result = await service.ensurePolicyExpression('policy-1', 'expr-1');

      expect(result).to.eql(existing);
      expect(insertStub).to.not.have.been.called;
    });

    it('creates policy expression when no active row exists', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const created = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      };
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves(null);
      const insertStub = sinon.stub(PolicyExpressionRepository.prototype, 'insertPolicyExpression').resolves(created);

      const result = await service.ensurePolicyExpression('policy-1', 'expr-1');

      expect(result).to.eql(created);
      expect(insertStub).to.have.been.calledOnceWithExactly({
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      });
    });

    it('passes through provided policy expression metadata when creating', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const created = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: 'Named expression',
        description: 'Useful expression'
      };
      sinon.stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionByPolicyAndExpressionId').resolves(null);
      const insertStub = sinon.stub(PolicyExpressionRepository.prototype, 'insertPolicyExpression').resolves(created);

      const result = await service.ensurePolicyExpression('policy-1', 'expr-1', {
        name: 'Named expression',
        description: 'Useful expression'
      });

      expect(result).to.eql(created);
      expect(insertStub).to.have.been.calledOnceWithExactly({
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: 'Named expression',
        description: 'Useful expression'
      });
    });
  });
});
