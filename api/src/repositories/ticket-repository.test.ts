import chai, { expect } from 'chai';
import { Knex } from 'knex';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { Ticket, TicketSlug } from '../models/ticket';
import { TicketRepository } from './ticket-repository';

chai.use(sinonChai);

describe('TicketRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicket: Ticket = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_slug: '04900001',
    subject: 'A ticket',
    description: 'desc',
    team_id: '22222222-2222-2222-2222-222222222222',
    create_date: '2026-02-25T00:00:00.000Z',
    priority: 'medium',
    status: 'open'
  };

  describe('applyFilters', () => {
    const makeMockQuery = () => {
      const query = {
        whereRaw: sinon.stub(),
        whereIn: sinon.stub(),
        andWhere: sinon.stub()
      } as unknown as Knex.QueryBuilder;

      (query.whereRaw as sinon.SinonStub).returns(query);
      (query.whereIn as sinon.SinonStub).returns(query);
      (query.andWhere as sinon.SinonStub).returns(query);

      return query;
    };

    it('calls whereRaw("false") when team_ids is an empty array', () => {
      const repo = new TicketRepository(getMockDBConnection());
      const query = makeMockQuery();

      repo.applyFilters(query, { team_ids: [] });

      expect(query.whereRaw as sinon.SinonStub).to.have.been.calledWith('false');
      expect(query.whereIn as sinon.SinonStub).to.not.have.been.called;
    });

    it('calls whereIn when team_ids has entries', () => {
      const repo = new TicketRepository(getMockDBConnection());
      const query = makeMockQuery();
      const teamIds = ['team-a', 'team-b'];

      repo.applyFilters(query, { team_ids: teamIds });

      expect(query.whereIn as sinon.SinonStub).to.have.been.calledWith('team_id', teamIds);
      expect(query.whereRaw as sinon.SinonStub).to.not.have.been.called;
    });

    it('applies no team filter when team_ids is undefined', () => {
      const repo = new TicketRepository(getMockDBConnection());
      const query = makeMockQuery();

      repo.applyFilters(query, { team_ids: undefined });

      expect(query.whereRaw as sinon.SinonStub).to.not.have.been.called;
      expect(query.whereIn as sinon.SinonStub).to.not.have.been.called;
    });
  });

  describe('insertTicket', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.insertTicket({
          subject: 'A',
          description: null,
          priority: 'medium',
          team_id: mockTicket.team_id,
          ticket_slug: mockTicket.ticket_slug
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to insert ticket record');
        }
      }
    });

    it('returns created ticket', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockTicket]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.insertTicket({
        subject: 'A',
        description: null,
        priority: 'medium',
        team_id: mockTicket.team_id,
        ticket_slug: mockTicket.ticket_slug
      });
      expect(result).to.eql(mockTicket);
    });
  });

  describe('getNextTicketSlug', () => {
    it('throws when slug generation fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.getNextTicketSlug();
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to generate ticket slug');
        }
      }
    });

    it('returns the next slug value', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ ticket_slug: '04900042' }]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getNextTicketSlug();

      expect(sqlStub).to.have.been.calledWithMatch(sinon.match.any, TicketSlug);
      expect(result).to.equal('04900042');
    });
  });

  describe('getTicketById', () => {
    it('throws when not found', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.getTicketById(mockTicket.ticket_id);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        if (error instanceof ApiNotFoundError) {
          expect(error.message).to.equal('Ticket not found');
        }
      }
    });

    it('returns ticket when found', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockTicket]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTicketById(mockTicket.ticket_id);
      expect(result).to.eql(mockTicket);
    });
  });

  describe('getTickets', () => {
    it('returns matching tickets', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockTicket]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTickets({ team_ids: [mockTicket.team_id], status: 'open' }, { page: 1, limit: 10 });
      expect(result).to.eql([mockTicket]);
    });
  });

  describe('getTicketsCount', () => {
    it('returns count', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([{ count: 7 }]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.getTicketsCount({ team_ids: [mockTicket.team_id], status: 'open' });
      expect(result).to.equal(7);
    });
  });

  describe('updateTicket', () => {
    it('throws when update fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      try {
        await repo.updateTicket(mockTicket.ticket_id, { subject: 'new subject' });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to update ticket record');
        }
      }
    });

    it('returns updated ticket', async () => {
      const updated: Ticket = { ...mockTicket, subject: 'new subject', status: 'closed' };
      const mockQueryResponse = Promise.resolve(mockQueryResult([updated]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketRepository(mockDBConnection);

      const result = await repo.updateTicket(mockTicket.ticket_id, { subject: 'new subject', status: 'closed' });
      expect(result).to.eql(updated);
    });
  });
});
