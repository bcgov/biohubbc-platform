import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamPolicyRepository } from './team-policy-repository';

chai.use(sinonChai);

describe('TeamPolicyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertTeamPolicy', () => {
    it('returns a team policy record on success', async () => {
      const mockRows = [{ team_policy_id: 1, team_id: '456xyz', policy_id: '123abc' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.insertTeamPolicy({ team_id: '456xyz', policy_id: '123abc' });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws an error if insert fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);

      try {
        await repository.insertTeamPolicy({ team_id: '456xyz', policy_id: '123abc' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert team policy');
      }
    });
  });

  describe('getTeamPolicy', () => {
    it('returns a team policy by ID', async () => {
      const mockRows = [{ team_policy_id: 1, team_id: '456xyz', policy_id: '123abc' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.getTeamPolicy('1');

      expect(result).to.eql(mockRows[0]);
    });

    it('throws an error if team policy not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);

      try {
        await repository.getTeamPolicy('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Team policy not found');
      }
    });
  });

  describe('getTeamPolicies', () => {
    it('returns all team policies', async () => {
      const mockRows = [
        { team_policy_id: 1, team_id: '11', policy_id: '123abc', team_name: 'Team 1', policy_name: 'Policy A' },
        { team_policy_id: 2, team_id: '11', policy_id: '456xyz', team_name: 'Team 1', policy_name: 'Policy B' }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.getTeamPolicies();

      expect(result).to.eql(mockRows);
    });

    it('returns empty array if no policies found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.getTeamPolicies();

      expect(result).to.eql([]);
    });
    it('returns all active team-policy associations with pagination options', async () => {
      const mockRows = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamPolicyRepository(mockConnection);

      const result = await repository.getTeamPolicies({ search: 'Test' }, { page: 1, limit: 10 });

      expect(result).to.eql(mockRows);
    });
  });

  describe('getPoliciesByTeamId', () => {
    it('returns active team policies for a team filtered by policy ids', async () => {
      const mockRows = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamPolicyRepository(mockConnection);

      const result = await repository.getPoliciesByTeamId('22222222-2222-2222-2222-222222222222', {
        policyIds: ['33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555']
      });

      expect(result).to.eql(mockRows);
    });

    it('does not apply policy id filter when policyIds is empty', async () => {
      const mockRows = [
        {
          team_policy_id: '11111111-1111-1111-1111-111111111111',
          team_id: '22222222-2222-2222-2222-222222222222',
          policy_id: '33333333-3333-3333-3333-333333333333',
          team_name: 'Test Team',
          policy_name: 'Test Policy'
        }
      ];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({ knex: knexStub });
      const repository = new TeamPolicyRepository(mockConnection);

      const result = await repository.getPoliciesByTeamId('22222222-2222-2222-2222-222222222222', { policyIds: [] });

      expect(result).to.eql(mockRows);
      expect(knexStub).to.have.been.calledOnce;
    });
  });

  describe('updateTeamPolicy', () => {
    it('returns updated team policy record', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ team_policy_id: 1, team_id: '456xyz', policy_id: '123abc' }]
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.updateTeamPolicy('1', { record_end_date: new Date().toISOString() });

      expect(result).to.eql({ team_policy_id: 1, team_id: '456xyz', policy_id: '123abc' });
    });

    it('throws error if update fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);

      try {
        await repository.updateTeamPolicy('1', { record_end_date: new Date().toISOString() });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update team policy');
      }
    });
  });

  describe('deleteTeamPolicy', () => {
    it('soft deletes a team policy successfully', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ team_policy_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({ knex: knexStub });

      const repository = new TeamPolicyRepository(mockConnection);
      await repository.deleteTeamPolicy('1');

      expect(knexStub).to.have.been.calledOnce;
    });

    it('throws error if delete fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);

      try {
        await repository.deleteTeamPolicy('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete team policy');
      }
    });
  });
});
