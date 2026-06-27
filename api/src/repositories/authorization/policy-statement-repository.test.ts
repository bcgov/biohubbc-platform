import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { PolicyEffect } from '../../models/policy-statement';
import { PolicyStatementRepository } from './policy-statement-repository';

chai.use(sinonChai);

describe('PolicyStatementRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPolicyStatement', () => {
    it('returns a policy statement record on success', async () => {
      const mockRows = [
        {
          policy_statement_id: 1,
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          security_scope_id: '11111111-1111-1111-1111-111111111111',
          submission_feature_urn: 'urn:biohub:submission:1',
          policy_expression_id: null
        }
      ];
      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({
        sql: sqlStub
      });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.insertPolicyStatement({
        policy_id: '123abc',
        effect: PolicyEffect.ALLOW,
        security_scope_id: '11111111-1111-1111-1111-111111111111'
      });

      expect(sqlStub).to.have.been.calledOnce;
      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockQueryResponse
      });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.insertPolicyStatement({
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          security_scope_id: '11111111-1111-1111-1111-111111111111'
        });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert policy statement');
      }
    });
  });

  describe('getPolicyStatement', () => {
    it('returns a policy statement record by ID', async () => {
      const mockRows = [
        {
          policy_statement_id: 1,
          policy_id: '123abc',
          effect: 'DENY',
          security_scope_id: '11111111-1111-1111-1111-111111111111',
          submission_feature_urn: 'urn:biohub:submission:2',
          policy_expression_id: 'pe-1'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.getPolicyStatement('1');

      expect(result).to.eql(mockRows[0]);
      const sql = knexStub.firstCall.args[0].toString();
      expect(sql).to.not.include('policy_statement_expression');
      expect(sql).to.include('"ps"."policy_expression_id"');
      expect(sql).to.include('"ps"."policy_statement_id" = \'1\'');
      expect(sql).to.include('"ps"."record_end_date" is null');
    });

    it('throws error if not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.getPolicyStatement('1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Policy statement not found');
      }
    });
  });

  describe('getPolicyStatements', () => {
    it('returns multiple policy statements', async () => {
      const mockPolicyId = '10';
      const mockRows = [
        {
          policy_statement_id: 1,
          policy_id: mockPolicyId,
          effect: PolicyEffect.ALLOW,
          security_scope_id: '11111111-1111-1111-1111-111111111111',
          submission_feature_urn: 'urn:biohub:submission:1',
          policy_expression_id: null
        },
        {
          policy_statement_id: 2,
          policy_id: mockPolicyId,
          effect: 'DENY',
          security_scope_id: '22222222-2222-2222-2222-222222222222',
          submission_feature_urn: 'urn:biohub:submission:2',
          policy_expression_id: 'pe-1'
        }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.getPolicyStatements(mockPolicyId);

      expect(result).to.eql(mockRows);
      const sql = knexStub.firstCall.args[0].toString();
      expect(sql).to.not.include('policy_statement_expression');
      expect(sql).to.include('"ps"."policy_expression_id"');
      expect(sql).to.include('"ps"."policy_id" = \'10\'');
      expect(sql).to.include('"ps"."record_end_date" is null');
    });
  });

  describe('getActiveStatementsWithExpressionByPolicyId', () => {
    it('returns rows joined to optional expression links', async () => {
      const mockRows = [
        {
          policy_statement_id: '11111111-1111-1111-1111-111111111111',
          urn_feature_type: 'survey',
          expression_id: null
        },
        {
          policy_statement_id: '22222222-2222-2222-2222-222222222222',
          urn_feature_type: 'observation',
          expression_id: '33333333-3333-3333-3333-333333333333'
        }
      ];
      const mockResponse = { rowCount: 2, rows: mockRows } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.getActiveStatementsWithExpressionByPolicyId('policy-1');

      expect(result).to.eql(mockRows);
      expect(knexStub).to.have.been.calledOnce;

      // Sanity-check the emitted SQL: ORDER BY urn_feature_type, LEFT JOIN with
      // record_end_date guard, and ps.policy_id filter.
      const queryArg = knexStub.firstCall.args[0];
      const sql = queryArg.toString();
      expect(sql).to.not.include('policy_statement_expression');
      expect(sql).to.include('left join "policy_expression"');
      expect(sql).to.include('"pe"."policy_expression_id" = "ps"."policy_expression_id"');
      expect(sql).to.include('"pe"."policy_id" = "ps"."policy_id"');
      expect(sql).to.include('"pe"."record_end_date" is null');
      expect(sql).to.include('"ps"."policy_id" = \'policy-1\'');
      expect(sql).to.include('"ps"."record_end_date" is null');
      expect(sql).to.include('order by "ss"."urn_feature_type"');
    });

    it('returns [] for a policy with no active statements (does NOT throw)', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.getActiveStatementsWithExpressionByPolicyId('policy-empty');

      expect(result).to.eql([]);
    });
  });

  describe('updatePolicyStatement', () => {
    it('returns updated policy statement record', async () => {
      const mockRows = [
        {
          policy_statement_id: 1,
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          security_scope_id: '11111111-1111-1111-1111-111111111111',
          submission_feature_urn: 'urn:biohub:submission:updated',
          policy_expression_id: null
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const sqlStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.updatePolicyStatement('1', {
        policy_id: '123abc',
        effect: PolicyEffect.ALLOW,
        security_scope_id: '11111111-1111-1111-1111-111111111111'
      });

      expect(sqlStub).to.have.been.calledOnce;
      expect(result).to.eql(mockRows[0]);
    });

    it('omits undefined fields from partial updates', async () => {
      const mockRows = [
        {
          policy_statement_id: 1,
          policy_id: '123abc',
          effect: PolicyEffect.DENY,
          security_scope_id: '11111111-1111-1111-1111-111111111111',
          submission_feature_urn: 'urn:biohub:submission:1',
          policy_expression_id: null
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({ sql: knexStub });

      const repository = new PolicyStatementRepository(mockDBConnection);
      await repository.updatePolicyStatement('1', {
        effect: PolicyEffect.DENY
      });

      const sql = knexStub.firstCall.args[0].text;
      expect(sql).to.include('effect = CASE WHEN');
      expect(sql).to.include('policy_expression_id = CASE WHEN');
      expect(sql).to.include('AND record_end_date IS NULL');
      expect(sql).to.not.include('SET submission_feature_urn');
    });

    it('throws error if update fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.updatePolicyStatement('1', {
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          security_scope_id: '11111111-1111-1111-1111-111111111111'
        });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update policy statement');
      }
    });
  });

  describe('deletePolicyStatement', () => {
    it('successfully soft deletes a policy statement', async () => {
      const mockResponse = { rowCount: 1, rows: [{ policy_statement_id: 1 }] } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({
        knex: knexStub
      });

      const repository = new PolicyStatementRepository(mockDBConnection);
      await repository.deletePolicyStatement('1');

      expect(knexStub).to.have.been.calledOnce;
      const sql = knexStub.firstCall.args[0].toString();
      expect(sql).to.include('"policy_statement_id" = \'1\'');
      expect(sql).to.include('"record_end_date" is null');
    });

    it('throws error if delete fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.deletePolicyStatement('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete policy statement');
      }
    });
  });
});
