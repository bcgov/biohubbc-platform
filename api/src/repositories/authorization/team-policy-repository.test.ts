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
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get team policy');
      }
    });
  });

  describe('getTeamPolicies', () => {
    it('returns all team policies', async () => {
      const mockTeamId = '11';
      const mockRows = [
        { team_policy_id: 1, team_id: mockTeamId, policy_id: '123abc' },
        { team_policy_id: 2, team_id: mockTeamId, policy_id: '456xyz' }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.getTeamPolicies(mockTeamId);

      expect(result).to.eql(mockRows);
    });

    it('returns empty array if no policies found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      const result = await repository.getTeamPolicies('15');

      expect(result).to.eql([]);
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

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamPolicyRepository(mockConnection);
      await repository.deleteTeamPolicy('1');
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
