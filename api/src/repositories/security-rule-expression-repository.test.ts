import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { SecurityRuleExpressionRepository } from './security-rule-expression-repository';

const securityRuleExpressionRow = {
  security_rule_expression_id: 'sre-1',
  security_rule_id: 1,
  expression_id: 'expr-1'
};

describe('SecurityRuleExpressionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSecurityRuleExpression', () => {
    it('returns inserted security_rule_expression row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([securityRuleExpressionRow], 1));
      const repository = new SecurityRuleExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertSecurityRuleExpression({
        security_rule_id: 1,
        expression_id: 'expr-1'
      });

      expect(result).to.eql(securityRuleExpressionRow);
    });
  });

  describe('getSecurityRuleExpressionById', () => {
    it('throws not found when row is missing', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new SecurityRuleExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getSecurityRuleExpressionById('sre-missing');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('deleteSecurityRuleExpressionsBySecurityRuleId', () => {
    it('soft deletes active rows and returns deleted links', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([securityRuleExpressionRow], 1));
      const repository = new SecurityRuleExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.deleteSecurityRuleExpressionsBySecurityRuleId(1);

      expect(result).to.eql([securityRuleExpressionRow]);
      expect(knexStub.callCount).to.equal(1);
    });
  });
});
