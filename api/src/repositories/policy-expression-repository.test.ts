import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { PolicyExpressionRepository } from './policy-expression-repository';

const policyExpressionRow = {
  policy_expression_id: 'pe-1',
  policy_id: 'policy-1',
  expression_id: 'expr-1',
  name: null,
  description: null
};

describe('PolicyExpressionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPolicyExpression', () => {
    it('inserts and returns the policy_expression row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyExpressionRow], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertPolicyExpression({
        policy_id: 'policy-1',
        expression_id: 'expr-1',
        name: null,
        description: null
      });

      expect(result).to.eql(policyExpressionRow);
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('insert into "policy_expression"');
      expect(sqlText).to.not.include('ON CONFLICT');
      expect(sqlText).to.include(
        'returning "policy_expression_id", "policy_id", "expression_id", "name", "description"'
      );
    });
  });

  describe('getPolicyExpressionById', () => {
    it('throws not found when row is missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getPolicyExpressionById('pe-missing');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('getPolicyExpressionByPolicyAndExpressionId', () => {
    it('returns null when row is missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPolicyExpressionByPolicyAndExpressionId('policy-1', 'expr-1');

      expect(result).to.be.null;
    });
  });
});
