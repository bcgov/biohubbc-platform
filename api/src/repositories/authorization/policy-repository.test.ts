import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { Policy } from '../../models/policy';
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
        rows: [{ policy_id: 1, name: 'Policy', description: 'Test policy', status: 'approved' }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.insertPolicy({ name: 'Policy', description: 'Test policy', status: 'requested' });

      expect(result).to.eql({ policy_id: 1, name: 'Policy', description: 'Test policy', status: 'approved' });
    });

    it('throws error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repository = new PolicyRepository(mockDBConnection);

      try {
        await repository.insertPolicy({ name: 'Policy', description: 'Test policy', status: 'requested' });
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
        rows: [{ policy_id: 1, name: 'Policy', description: 'Test', status: 'approved' }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockResponse
      });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPolicy('1');

      expect(result).to.eql({ policy_id: 1, name: 'Policy', description: 'Test', status: 'approved' });
    });

    it('throws error if not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);

      try {
        await repository.getPolicy('1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Policy not found');
      }
    });
  });

  describe('getPolicies', () => {
    it('returns multiple policies', async () => {
      const mockRows = [
        { policy_id: 1, name: 'Policy1', description: 'Test1', status: 'approved' },
        { policy_id: 2, name: 'Policy2', description: 'Test2', status: 'approved' }
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

  describe('getPolicies', () => {
    it('returns paginated policies', async () => {
      const mockPolicies: Policy[] = [
        {
          policy_id: '11111111-1111-1111-1111-111111111111',
          name: 'Policy1',
          description: 'Test1',
          status: 'approved'
        },
        {
          policy_id: '22222222-2222-2222-2222-222222222222',
          name: 'Policy2',
          description: 'Test2',
          status: 'approved'
        }
      ];

      const mockResponse = {
        rowCount: 2,
        rows: mockPolicies
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPolicies(undefined, { page: 1, limit: 2 });

      expect(result).to.eql(mockPolicies);
    });

    it('filters by search term', async () => {
      const mockPolicies = [{ policy_id: '1', name: 'Telemetry Policy', description: 'Test', status: 'approved' }];

      const mockResponse = {
        rowCount: 1,
        rows: mockPolicies
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPolicies({ search: 'Telemetry' }, { page: 1, limit: 50 });

      expect(result).to.eql(mockPolicies);
    });

    it('returns empty array when no policies exist', async () => {
      const mockResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPolicies(undefined, { page: 1, limit: 50 });

      expect(result).to.eql([]);
    });
  });

  describe('getPoliciesCount', () => {
    it('returns count for matching policies', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ count: 2 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPoliciesCount();

      expect(result).to.equal(2);
    });

    it('returns zero when no rows are returned', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ count: 0 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new PolicyRepository(mockDBConnection);
      const result = await repository.getPoliciesCount({ search: 'none' });

      expect(result).to.equal(0);
    });
  });

  describe('getPoliciesThatAuthorizeFeatureAccessByUrn', () => {
    it('returns policies matching URN and user', async () => {
      const mockRows = [
        { policy_id: 1, name: 'Telemetry', description: 'Access telemetry features', status: 'approved' }
      ];
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
      const mockRows = [{ policy_id: 1, name: 'Updated', description: 'Updated desc', status: 'approved' }];
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
