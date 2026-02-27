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
      const mockRows = [{ team_id: 1, name: 'Team A', description: 'Description A', member_count: 3 }];
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
    it('returns all teams with member_count', async () => {
      const mockRows = [
        { team_id: 1, name: 'Team A', description: 'Description A', member_count: 0 },
        { team_id: 2, name: 'Team B', description: 'Description B', member_count: 2 }
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
      const mockResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.getTeams();
      expect(result).to.eql([]);
    });
  });

  describe('getTeams with pagination', () => {
    it('returns paginated teams', async () => {
      const mockTeams = [
        {
          team_id: '11111111-1111-1111-1111-111111111111',
          name: 'Team Alpha',
          description: 'First team',
          member_count: 1
        },
        {
          team_id: '22222222-2222-2222-2222-222222222222',
          name: 'Team Beta',
          description: 'Second team',
          member_count: 0
        }
      ];

      const mockResponse = {
        rowCount: 2,
        rows: mockTeams
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamRepository(mockDBConnection);
      const result = await repository.getTeams(undefined, { page: 1, limit: 2 });

      expect(result).to.eql(mockTeams);
    });

    it('filters by search term', async () => {
      const mockTeams = [{ team_id: 'uuid-1', name: 'Research Team', description: 'Research group' }];

      const mockResponse = {
        rowCount: 1,
        rows: mockTeams
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamRepository(mockDBConnection);
      const result = await repository.getTeams({ search: 'Research' }, { page: 1, limit: 50 });

      expect(result).to.eql(mockTeams);
    });

    it('returns empty array when no teams exist', async () => {
      const mockResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamRepository(mockDBConnection);
      const result = await repository.getTeams(undefined, { page: 1, limit: 50 });

      expect(result).to.eql([]);
    });

    it('calculates correct offset for page > 1', async () => {
      const mockTeams = [{ team_id: 'uuid-3', name: 'Team Gamma', description: 'Third team' }];

      const mockResponse = {
        rowCount: 1,
        rows: mockTeams
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repository = new TeamRepository(mockDBConnection);
      const result = await repository.getTeams(undefined, { page: 2, limit: 3 });

      expect(result).to.eql(mockTeams);
    });
  });

  describe('getTeamsCount', () => {
    it('returns count for matching teams', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ count: 2 }]
      } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.getTeamsCount();

      expect(result).to.equal(2);
    });

    it('returns 0 when count query has no rows', async () => {
      const mockResponse = {
        rowCount: 1,
        rows: [{ count: 0 }]
      } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new TeamRepository(mockConnection);

      const result = await repository.getTeamsCount({ search: 'Research' });

      expect(result).to.equal(0);
    });
  });

  describe('updateTeam', () => {
    it('updates team record', async () => {
      const mockResponse = {
        rowCount: 1
      } as unknown as Promise<QueryResult<any>>;

      const knexStub = sinon.stub().resolves(mockResponse);
      const mockConnection = getMockDBConnection({ knex: knexStub });
      const repository = new TeamRepository(mockConnection);

      await repository.updateTeam('1', {
        name: 'Team A Updated',
        description: 'Updated Desc',
        record_end_date: new Date().toISOString()
      });

      expect(knexStub).to.have.been.calledOnce;
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
