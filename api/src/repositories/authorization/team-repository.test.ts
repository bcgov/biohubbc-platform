import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { getMockDBConnection } from '../../__mocks__/db';
import { TeamRepository } from './team-repository';

chai.use(sinonChai);

describe('TeamRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertTeam', () => {
    it('returns a team record on success', async () => {
      const mockRows = [{ team_id: 1, name: 'Team A', description: 'Description A' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.insertTeam({ name: 'Team A', description: 'Description A' });

      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if insert fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      try {
        await repository.insertTeam({ name: 'Team A', description: 'Description A' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert team');
      }
    });
  });

  describe('getTeam', () => {
    it('returns a team by ID', async () => {
      const mockRows = [{ team_id: 1, name: 'Team A', description: 'Description A' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.getTeam('1');
      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if team not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      try {
        await repository.getTeam('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get team');
      }
    });
  });

  describe('getTeams', () => {
    it('returns all teams', async () => {
      const mockRows = [
        { team_id: 1, name: 'Team A', description: 'Description A' },
        { team_id: 2, name: 'Team B', description: 'Description B' }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.getTeams();
      expect(result).to.eql(mockRows);
    });

    it('returns empty array if no teams', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.getTeams();
      expect(result).to.eql([]);
    });
  });

  describe('updateTeam', () => {
    it('returns updated team record', async () => {
      const mockRows = [{ team_id: 1, name: 'Team A Updated', description: 'Updated Desc' }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.updateTeam('1', {
        name: 'Team A Updated',
        description: 'Updated Desc',
        record_end_date: new Date().toISOString()
      });
      expect(result).to.eql(mockRows[0]);
    });

    it('throws error if update fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      try {
        await repository.updateTeam('1', {
          name: 'Team A Updated',
          description: 'Updated Desc',
          record_end_date: new Date().toISOString()
        });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update team');
      }
    });
  });

  describe('deleteTeam', () => {
    it('soft deletes a team successfully', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ team_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({
        knex: knexStub
      });
      const repository = new TeamRepository(mockConnection);

      await repository.deleteTeam('1');

      expect(knexStub).to.have.been.calledOnce;
    });

    it('throws error if delete fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      try {
        await repository.deleteTeam('1');
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete team');
      }
    });
  });
});
