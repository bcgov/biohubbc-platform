import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ExpressionTree } from '../../models/expression-tree';
import { PolicyExpressionRepository } from '../../repositories/policy-expression-repository';
import { ExpressionTreeService } from '../expression-tree-service';
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

  describe('createPolicyExpression', () => {
    it('delegates to repository insertion', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());

      const policyExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: 'Named expression',
        description: null
      };

      const insertStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'insertPolicyExpression')
        .resolves(policyExpression);

      const result = await service.createPolicyExpression({
        policyId: 'policy-1',
        expressionId: 'expr-1',
        name: 'Named expression',
        description: null
      });

      expect(result).to.eql(policyExpression);
      expect(insertStub).to.have.been.calledOnceWithExactly({
        policyId: 'policy-1',
        expressionId: 'expr-1',
        name: 'Named expression',
        description: null
      });
    });
  });

  describe('getPolicyExpressionByPolicyAndExpressionId', () => {
    it('passes through to the repository', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const row = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      };
      const repositoryStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'getPolicyExpressionByPolicyAndExpressionId')
        .resolves(row);

      const result = await service.getPolicyExpressionByPolicyAndExpressionId('policy-1', 'expr-1');

      expect(result).to.eql(row);
      expect(repositoryStub).to.have.been.calledOnceWithExactly('policy-1', 'expr-1');
    });
  });

  describe('updatePolicyExpression', () => {
    it('delegates pointer patching to the repository', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const policyExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-2',
        name: null,
        description: null
      };
      const updateStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'updatePolicyExpression')
        .resolves(policyExpression);

      const result = await service.updatePolicyExpression('pe-1', { expressionId: 'expr-2' });

      expect(result).to.eql(policyExpression);
      expect(updateStub).to.have.been.calledOnceWithExactly('pe-1', { expressionId: 'expr-2' });
    });
  });

  describe('hasActivePolicyStatementReferences', () => {
    it('delegates to the repository with the policy and policy expression ids', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const repositoryStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'hasActivePolicyStatementReferences')
        .resolves(true);

      const result = await service.hasActivePolicyStatementReferences('policy-1', 'pe-1');

      expect(result).to.equal(true);
      expect(repositoryStub).to.have.been.calledOnceWithExactly('policy-1', 'pe-1');
    });
  });

  describe('updatePolicyExpressionTree', () => {
    it('resolves the incoming tree to an expression id, then patches the existing policy expression', async () => {
      const service = new PolicyExpressionService(getMockDBConnection());
      const expression = {
        type: 'expression',
        operator: 'AND',
        clauses: [
          {
            type: 'predicate',
            feature_type_property_id: 1,
            operator: 'Equals',
            value: 'A'
          }
        ]
      } as ExpressionTree;
      const policyExpression = {
        policy_expression_id: 'pe-1',
        policy_id: 'policy-1',
        expression_id: 'expr-2',
        name: null,
        description: null
      };
      const writeStub = sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .resolves({ expression_id: 'expr-2' });
      const updateStub = sinon
        .stub(PolicyExpressionRepository.prototype, 'updatePolicyExpression')
        .resolves(policyExpression);

      const result = await service.updatePolicyExpressionTree('pe-1', expression);

      expect(result).to.eql(policyExpression);
      expect(writeStub).to.have.been.calledOnceWithExactly(expression);
      expect(updateStub).to.have.been.calledOnceWithExactly('pe-1', { expressionId: 'expr-2' });
    });
  });
});
