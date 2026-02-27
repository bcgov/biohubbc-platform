import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { PolicyEffect } from '../../models/policy-statement';
import { getMockDBConnection } from '../../__mocks__/db';
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
          submission_feature_urn: 'urn:biohub:submission:1'
        }
      ];
      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.insertPolicyStatement({
        policy_id: '123abc',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:biohub:submission:1'
      });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.insertPolicyStatement({
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:biohub:submission:1'
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
          submission_feature_urn: 'urn:biohub:submission:2'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockResponse
      });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.getPolicyStatement('1');

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.getPolicyStatement('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Policy statement not found');
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
          submission_feature_urn: 'urn:biohub:submission:1'
        },
        {
          policy_statement_id: 2,
          policy_id: mockPolicyId,
          effect: 'DENY',
          submission_feature_urn: 'urn:biohub:submission:2'
        }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.getPolicyStatements(mockPolicyId);

      expect(result).to.eql(mockRows);
    });
  });

  describe('updatePolicyStatement', () => {
    it('returns updated policy statement record', async () => {
      const mockRows = [
        {
          policy_statement_id: 1,
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:biohub:submission:updated'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementRepository(mockDBConnection);
      const result = await repository.updatePolicyStatement('1', {
        policy_id: '123abc',
        effect: PolicyEffect.ALLOW,
        submission_feature_urn: 'urn:biohub:submission:updated'
      });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if update fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyStatementRepository(mockDBConnection);

      try {
        await repository.updatePolicyStatement('1', {
          policy_id: '123abc',
          effect: PolicyEffect.ALLOW,
          submission_feature_urn: 'urn:biohub:submission:updated'
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
