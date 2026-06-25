import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
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
    it('returns null when no active policy expression exists for the policy and expression', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPolicyExpressionByPolicyAndExpressionId('policy-1', 'expr-1');

      expect(result).to.be.null;
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('from "policy_expression"');
      expect(sqlText).to.include('"policy_id" = \'policy-1\'');
      expect(sqlText).to.include('"expression_id" = \'expr-1\'');
      expect(sqlText).to.include('"record_end_date" is null');
    });

    it('throws when more than one active policy expression exists for the policy and expression', async () => {
      const knexStub = sinon
        .stub()
        .resolves(mockQueryResult([policyExpressionRow, { ...policyExpressionRow, policy_expression_id: 'pe-2' }], 2));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.getPolicyExpressionByPolicyAndExpressionId('policy-1', 'expr-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('ensurePolicyExpression', () => {
    it('maps camelCase payload fields to snake_case database columns', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([policyExpressionRow], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.ensurePolicyExpression({
        policyId: 'policy-1',
        expressionId: 'expr-1',
        name: null,
        description: null
      });

      expect(result).to.eql(policyExpressionRow);
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('INSERT INTO policy_expression');
      expect(sqlText).to.include('json_build_array($1::uuid, $2::uuid)');
      expect(sqlText).to.include('policy_id');
      expect(sqlText).to.include('expression_id');
      expect(sqlText).to.not.include('policyId');
      expect(sqlText).to.not.include('expressionId');
    });

    it('throws when ensure does not return one row', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.ensurePolicyExpression({
          policyId: 'policy-1',
          expressionId: 'expr-1'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('insertPolicyExpression', () => {
    it('inserts a new policy expression row', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyExpressionRow], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.insertPolicyExpression({
        policyId: 'policy-1',
        expressionId: 'expr-1',
        name: 'Expression',
        description: null
      });

      expect(result).to.eql(policyExpressionRow);
      const sqlText = knexStub.firstCall.args[0].toSQL().sql;
      expect(sqlText).to.include('insert into "policy_expression"');
    });
  });

  describe('getPolicyExpressionsByPolicyId', () => {
    it('returns active policy expressions with pagination', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([policyExpressionRow], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPolicyExpressionsByPolicyId('policy-1', {
        page: 2,
        limit: 10,
        sort: 'name',
        order: 'asc'
      });

      expect(result).to.eql([policyExpressionRow]);
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('where "policy_id" = \'policy-1\'');
      expect(sqlText).to.include('"record_end_date" is null');
      expect(sqlText).to.not.include('expression_rank');
      expect(sqlText).to.include('order by "name" asc');
      expect(sqlText).to.include('limit 10');
      expect(sqlText).to.include('offset 10');
    });
  });

  describe('hasActivePolicyStatementReferences', () => {
    it('returns true when an active statement references the policy expression', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ policy_statement_id: 'statement-1' }], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.hasActivePolicyStatementReferences('policy-1', 'pe-1');

      expect(result).to.equal(true);
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('from "policy_statement"');
      expect(sqlText).to.include('"policy_id" = \'policy-1\'');
      expect(sqlText).to.include('"policy_expression_id" = \'pe-1\'');
      expect(sqlText).to.include('"record_end_date" is null');
    });

    it('returns false when no active statement references the policy expression', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.hasActivePolicyStatementReferences('policy-1', 'pe-1');

      expect(result).to.equal(false);
    });
  });

  describe('getPolicyExpressionsCountByPolicyId', () => {
    it('counts active policy expression rows for a policy', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 2 }], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.getPolicyExpressionsCountByPolicyId('policy-1');

      expect(result).to.equal(2);
      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('coalesce(count(*), 0)::integer as count');
      expect(sqlText).to.include('from "policy_expression"');
      expect(sqlText).to.include('"policy_id" = \'policy-1\'');
      expect(sqlText).to.include('"record_end_date" is null');
    });
  });

  describe('updatePolicyExpression', () => {
    it('patches expression_id on the existing policy_expression row', async () => {
      const updatedRow = { ...policyExpressionRow, expression_id: 'expr-2' };
      const knexStub = sinon.stub().resolves(mockQueryResult([updatedRow], 1));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      const result = await repository.updatePolicyExpression('pe-1', { expressionId: 'expr-2' });

      expect(result).to.eql(updatedRow);
      const sqlText = knexStub.firstCall.args[0].toSQL().sql;
      expect(sqlText).to.include('update "policy_expression"');
      expect(sqlText).to.include('set "expression_id" = ?');
      expect(sqlText).to.include('where "policy_expression_id" = ?');
      expect(sqlText).to.include('"record_end_date" is null');
      expect(sqlText).to.not.include('insert into');
    });

    it('throws not found when patching a missing policy_expression', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repository = new PolicyExpressionRepository(getMockDBConnection({ knex: knexStub }));

      try {
        await repository.updatePolicyExpression('pe-missing', { expressionId: 'expr-2' });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });
});
