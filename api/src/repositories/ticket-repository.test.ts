import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Ticket, TicketSlug } from '../models/ticket';
import { getMockDBConnection } from '../__mocks__/db';
import { TicketRepository } from './ticket-repository';

chai.use(sinonChai);

describe('TicketRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicket: Ticket = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_slug: '04900001',
    title: 'A ticket',
    description: 'desc',
    team_id: '22222222-2222-2222-2222-222222222222',
    create_date: '2026-02-25T00:00:00.000Z',
    priority: 'medium',
    status: 'open'
  };

  describe('insertTicket', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.insertTicket({
          title: 'A',
          team_id: mockTicket.team_id,
          ticket_slug: mockTicket.ticket_slug
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert ticket record');
      }
    });

    it('returns created ticket', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [mockTicket] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.insertTicket({
        title: 'A',
        team_id: mockTicket.team_id,
        ticket_slug: mockTicket.ticket_slug
      });
      expect(result).to.eql(mockTicket);
    });
  });

  describe('getNextTicketSlug', () => {
    it('throws when slug generation fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.getNextTicketSlug();
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to generate ticket slug');
      }
    });

    it('returns the next slug value', async () => {
      const sqlStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [{ ticket_slug: '04900042' }]
      } as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getNextTicketSlug();

      expect(sqlStub).to.have.been.calledWithMatch(sinon.match.any, TicketSlug);
      expect(result).to.equal('04900042');
    });
  });

  describe('getTicketById', () => {
    it('throws when not found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.getTicketById(mockTicket.ticket_id);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get ticket record');
      }
    });

    it('returns ticket when found', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [mockTicket] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTicketById(mockTicket.ticket_id);
      expect(result).to.eql(mockTicket);
    });
  });

  describe('getTicketsByTeamId', () => {
    it('returns matching tickets', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [mockTicket] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTicketsByTeamId(mockTicket.team_id, { status: 'open' }, { page: 1, limit: 10 });
      expect(result).to.eql([mockTicket]);
    });
  });

  describe('getTicketsByTeamIdCount', () => {
    it('returns count', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ count: 7 }] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTicketsByTeamIdCount(mockTicket.team_id, { status: 'open' });
      expect(result).to.equal(7);
    });
  });

  describe('updateTicket', () => {
    it('throws when update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.updateTicket(mockTicket.ticket_id, { title: 'new title' });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update ticket record');
      }
    });

    it('returns updated ticket', async () => {
      const updated: Ticket = { ...mockTicket, title: 'new title', status: 'closed' };
      const mockQueryResponse = { rowCount: 1, rows: [updated] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.updateTicket(mockTicket.ticket_id, { title: 'new title', status: 'closed' });
      expect(result).to.eql(updated);
    });
  });

  describe('insertTicketStatusHistory', () => {
    it('throws when insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.insertTicketStatusHistory(mockTicket.ticket_id, 'open');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert ticket status history');
      }
    });

    it('returns inserted status history row', async () => {
      const mockRow = {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: mockTicket.ticket_id,
        create_date: '2026-02-25T00:00:00.000Z',
        status: 'open' as const
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.insertTicketStatusHistory(mockTicket.ticket_id, 'open');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getTicketStatusHistory', () => {
    it('returns rows ordered by query', async () => {
      const rows = [
        {
          ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
          ticket_id: mockTicket.ticket_id,
          create_date: '2026-02-25T00:00:00.000Z',
          status: 'open' as const
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTicketStatusHistory(mockTicket.ticket_id);
      expect(result).to.eql(rows);
    });
  });
});
