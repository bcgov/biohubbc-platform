import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { PolicyStatementConditionExpressionRepository } from './policy-statement-condition-expression-repository';

const policyStatementConditionExpressionRow = {
  policy_statement_condition_expression_id: 'psce-1',
  policy_statement_condition_id: 'psc-1',
  expression_id: 'expr-1'
};

describe('PolicyStatementConditionExpressionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPolicyStatementConditionExpression', () => {
    it('returns inserted policy_statement_condition_expression row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyStatementConditionExpressionRow], 1));
      const repository = new PolicyStatementConditionExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertPolicyStatementConditionExpression({
        policy_statement_condition_id: 'psc-1',
        expression_id: 'expr-1'
      });

      expect(result).to.eql(policyStatementConditionExpressionRow);
    });
  });

  describe('getPolicyStatementConditionExpressionById', () => {
    it('throws not found when row is missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyStatementConditionExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getPolicyStatementConditionExpressionById('psce-missing');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('deletePolicyStatementConditionExpressionsByPolicyStatementConditionId', () => {
    it('soft deletes active rows and returns deleted links', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyStatementConditionExpressionRow], 1));
      const repository = new PolicyStatementConditionExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.deletePolicyStatementConditionExpressionsByPolicyStatementConditionId('psc-1');

      expect(result).to.eql([policyStatementConditionExpressionRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });
});
