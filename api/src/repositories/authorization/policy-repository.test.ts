import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { getMockDBConnection } from '../../__mocks__/db';
import { PolicyRepository } from './policy-repository';

chai.use(sinonChai);

describe('PolicyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertPolicy', () => {
    it('returns a policy record on success', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ policy_id: 1, name: 'Policy', description: 'Test policy' }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.insertPolicy({ name: 'Policy', description: 'Test policy' });

      expect(result).to.eql({ policy_id: 1, name: 'Policy', description: 'Test policy' });
    });

    it('throws error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyRepository(mockDBConnection);

      try {
        await repository.insertPolicy({ name: 'Policy', description: 'Test policy' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert policy');
      }
    });
  });

  describe('getPolicy', () => {
    it('returns a policy record by ID', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ policy_id: 1, name: 'Policy', description: 'Test' }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockResponse
      });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPolicy('1');

      expect(result).to.eql({ policy_id: 1, name: 'Policy', description: 'Test' });
    });

    it('throws error if not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);

      try {
        await repository.getPolicy('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get policy');
      }
    });
  });

  describe('getPolicies', () => {
    it('returns multiple policies', async () => {
      const mockRows = [
        { policy_id: 1, name: 'Policy1', description: 'Test1' },
        { policy_id: 2, name: 'Policy2', description: 'Test2' }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPolicies();

      expect(result).to.eql(mockRows);
    });
  });

  describe('getPoliciesThatAuthorizeFeatureAccessByUrn', () => {
    it('returns policies matching URN and user', async () => {
      const mockRows = [{ policy_id: 1, name: 'Telemetry', description: 'Access telemetry features' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: async () => mockResponse
      });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPoliciesThatAuthorizeFeatureAccessByUrn(
        { submissionId: '1', featureTypeName: 'telemetry', submissionFeatureId: '1' },
        10
      );

      expect(result).to.eql(mockRows);
    });
  });

  describe('updatePolicy', () => {
    it('returns updated policy record', async () => {
      const mockRows = [{ policy_id: 1, name: 'Updated', description: 'Updated desc' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.updatePolicy('1', {
        name: 'Updated',
        description: 'Updated desc'
      });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if update fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);

      try {
        await repository.updatePolicy('1', {
          name: 'Updated',
          description: 'Updated desc'
        });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update policy');
      }
    });
  });

  describe('deletePolicy', () => {
    it('successfully soft deletes a policy', async () => {
      const mockResponse = { rowCount: 1, rows: [{ policy_id: 1 }] } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockDBConnection = getMockDBConnection({
        knex: knexStub
      });

      const repository = new PolicyRepository(mockDBConnection);
      await repository.deletePolicy('1');

      expect(knexStub).to.have.been.calledOnce;
    });

    it('throws error if delete fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);

      try {
        await repository.deletePolicy('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete policy');
      }
    });
  });
});
