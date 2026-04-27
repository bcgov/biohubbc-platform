import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { PolicyStatementExpressionRepository } from './policy-statement-expression-repository';

const policyStatementExpressionRow = {
  policy_statement_expression_id: 'pse-1',
  policy_statement_id: 'ps-1',
  expression_id: 'expr-1'
};

describe('PolicyStatementExpressionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPolicyStatementExpression', () => {
    it('returns inserted policy_statement_expression row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyStatementExpressionRow], 1));
      const repository = new PolicyStatementExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertPolicyStatementExpression({
        policy_statement_id: 'ps-1',
        expression_id: 'expr-1'
      });

      expect(result).to.eql(policyStatementExpressionRow);
    });
  });

  describe('getPolicyStatementExpressionById', () => {
    it('throws not found when row is missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyStatementExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getPolicyStatementExpressionById('pse-missing');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('deletePolicyStatementExpressionsByPolicyStatementId', () => {
    it('soft deletes active rows and returns deleted links', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyStatementExpressionRow], 1));
      const repository = new PolicyStatementExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.deletePolicyStatementExpressionsByPolicyStatementId('ps-1');

      expect(result).to.eql([policyStatementExpressionRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });
});
