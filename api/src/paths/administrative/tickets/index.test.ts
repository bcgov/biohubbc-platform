import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { Ticket } from '../../../models/ticket';
import { TicketService } from '../../../services/ticket-service';
import { createTicket, getTickets } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets', () => {
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

  afterEach(() => {
    sinon.restore();
  });

  it('POST createTicket returns 201 with created ticket', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TicketService.prototype, 'createTicket').resolves(mockTicket);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { subject: 'A ticket', description: null, priority: 'medium' };

    await createTicket()(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockTicket);
  });

  it('GET getTickets returns paginated response', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const listStub = sinon.stub(TicketService.prototype, 'getTickets').resolves([mockTicket]);
    const countStub = sinon.stub(TicketService.prototype, 'getTicketsCount').resolves(21);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { team_id: mockTicket.team_id, status: 'open', search: 'ticket', page: '2', limit: '10' };

    await getTickets()(mockReq, mockRes, mockNext);

    expect(listStub).to.have.been.calledWith(
      { team_id: mockTicket.team_id, status: 'open', search: 'ticket' },
      {
        page: 2,
        limit: 10,
        sort: undefined,
        order: undefined
      }
    );
    expect(countStub).to.have.been.calledWith({
      team_id: mockTicket.team_id,
      status: 'open',
      search: 'ticket'
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      tickets: [mockTicket],
      pagination: {
        total: 21,
        per_page: 10,
        current_page: 2,
        last_page: 3,
        sort: undefined,
        order: undefined
      }
    });
  });

  it('GET getTickets returns all tickets when team_id is omitted', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const listStub = sinon.stub(TicketService.prototype, 'getTickets').resolves([mockTicket]);
    const countStub = sinon.stub(TicketService.prototype, 'getTicketsCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { page: '1', limit: '10' };
    const noFilters = { team_id: undefined, status: undefined, search: undefined };

    await getTickets()(mockReq, mockRes, mockNext);

    expect(listStub).to.have.been.calledWith(noFilters, {
      page: 1,
      limit: 10,
      sort: undefined,
      order: undefined
    });
    expect(countStub).to.have.been.calledWith(noFilters);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      tickets: [mockTicket],
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
        sort: undefined,
        order: undefined
      }
    });
  });
});
