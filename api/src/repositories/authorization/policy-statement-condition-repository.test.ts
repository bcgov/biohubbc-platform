import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { PolicyConditionOperator } from '../../models/policy-statement-condition';
import { PolicyStatementConditionRepository } from './policy-statement-condition-repository';

chai.use(sinonChai);

describe('PolicyStatementConditionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPolicyStatementCondition', () => {
    it('returns a policy statement condition record on success', async () => {
      const mockRows = [
        {
          policy_statement_condition_id: 1,
          policy_statement_id: '123abc',
          operator: PolicyConditionOperator.STRING_EQUALS,
          key: 'region',
          value: 'BC'
        }
      ];
      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);
      const result = await repository.insertPolicyStatementCondition({
        policy_statement_id: '123abc',
        operator: PolicyConditionOperator.STRING_EQUALS,
        key: 'region',
        value: 'BC'
      });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);

      try {
        await repository.insertPolicyStatementCondition({
          policy_statement_id: '123abc',
          operator: PolicyConditionOperator.STRING_EQUALS,
          key: 'region',
          value: 'BC'
        });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert policy statement condition');
      }
    });
  });

  describe('getPolicyStatementCondition', () => {
    it('returns a policy statement condition record by ID', async () => {
      const mockRows = [
        {
          policy_statement_condition_id: 1,
          policy_statement_id: 10,
          operator: PolicyConditionOperator.STRING_EQUALS,
          key: 'region',
          value: 'BC'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockResponse
      });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);
      const result = await repository.getPolicyStatementCondition('1');

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);

      try {
        await repository.getPolicyStatementCondition('1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Policy statement condition not found');
      }
    });
  });

  describe('getPolicyStatementConditions', () => {
    it('returns multiple policy statement conditions', async () => {
      const mockPolicyStatementId = '10';
      const mockRows = [
        {
          policy_statement_condition_id: 1,
          policy_statement_id: mockPolicyStatementId,
          operator: PolicyConditionOperator.STRING_EQUALS,
          key: 'region',
          value: 'BC'
        },
        {
          policy_statement_condition_id: 2,
          policy_statement_id: mockPolicyStatementId,
          operator: PolicyConditionOperator.STRING_NOT_EQUALS,
          key: 'type',
          value: 'restricted'
        }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);
      const result = await repository.getPolicyStatementConditions(mockPolicyStatementId);

      expect(result).to.eql(mockRows);
    });
  });

  describe('deletePolicyStatementCondition', () => {
    it('successfully soft deletes a policy statement condition', async () => {
      const mockRows = [{ policy_statement_condition_id: 1 }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({
        knex: knexStub
      });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);
      await repository.deletePolicyStatementCondition('1');

      expect(knexStub).to.have.been.calledOnce;
    });

    it('throws error if delete fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementConditionRepository(mockDBConnection);

      try {
        await repository.deletePolicyStatementCondition('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete policy statement condition');
      }
    });
  });
});
