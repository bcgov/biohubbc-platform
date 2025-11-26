import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamMemberRepository } from './team-member-repository';

chai.use(sinonChai);

describe('TeamMemberRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertTeamMember', () => {
    it('returns a team member record on success', async () => {
      const mockRows = [{ team_member_id: 1, system_user_id: 10, team_id: '123abc' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({
        knex: async () => mockResponse
      });

      const repository = new TeamMemberRepository(mockConnection);
      const result = await repository.insertTeamMember({ system_user_id: 10, team_id: '123abc' });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws an error if insert fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);

      try {
        await repository.insertTeamMember({ system_user_id: 10, team_id: '123abc' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert team member');
      }
    });
  });

  describe('getTeamMember', () => {
    it('returns a team member by ID', async () => {
      const mockRows = [{ team_member_id: 1, system_user_id: 10, team_id: '123abc' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);
      const result = await repository.getTeamMember('1');

      expect(result).to.eql(mockRows[0]);
    });

    it('throws an error if team member not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);

      try {
        await repository.getTeamMember('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get team member');
      }
    });
  });

  describe('getTeamMembersByTeamId', () => {
    it('returns all team members for a given team', async () => {
      const mockRows = [
        { team_member_id: 1, system_user_id: 10, team_id: '123abc' },
        { team_member_id: 2, system_user_id: 11, team_id: '123abc' }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);
      const result = await repository.getTeamMembersByTeamId('123abc');

      expect(result).to.eql(mockRows);
    });

    it('returns empty array if no members found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);
      const result = await repository.getTeamMembersByTeamId('999');

      expect(result).to.eql([]);
    });
  });

  describe('updateTeamMember', () => {
    it('returns updated team member record', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ team_member_id: 1, system_user_id: 10, team_id: '123abc' }]
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);
      const result = await repository.updateTeamMember('1', { record_end_date: new Date().toISOString() });

      expect(result).to.eql({ team_member_id: 1, system_user_id: 10, team_id: '123abc' });
    });

    it('throws error if update fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);

      try {
        await repository.updateTeamMember('1', { record_end_date: new Date().toISOString() });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update team member');
      }
    });
  });

  describe('deleteTeamMember', () => {
    it('soft deletes a team member successfully', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ team_member_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({
        knex: knexStub
      });

      const repository = new TeamMemberRepository(mockConnection);
      await repository.deleteTeamMember('1');

      expect(knexStub).to.have.been.calledOnce;
    });

    it('throws error if delete fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamMemberRepository(mockConnection);

      try {
        await repository.deleteTeamMember('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete team member');
      }
    });
  });
});
