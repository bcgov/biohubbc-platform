import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { TicketService } from '../../../services/ticket-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { getTicket, patchTicket } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}', () => {
  const mockTicket = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_number: 1,
    title: 'A ticket',
    description: 'desc',
    team_id: '22222222-2222-2222-2222-222222222222',
    priority: 'MEDIUM' as const,
    status: 'OPEN' as const
  };
  const mockTicketWithHistory = {
    ...mockTicket,
    history: [
      {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: mockTicket.ticket_id,
        status: 'OPEN' as const
      }
    ]
  };

  afterEach(() => {
    sinon.restore();
  });

  it('GET returns ticket by id', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TicketService.prototype, 'getTicket').resolves(mockTicketWithHistory as any);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: mockTicket.ticket_id };

    await getTicket()(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(mockTicketWithHistory);
  });

  it('PATCH updates ticket', async () => {
    const updated = { ...mockTicket, title: 'updated' };
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const updateStub = sinon.stub(TicketService.prototype, 'updateTicket').resolves(updated as any);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: mockTicket.ticket_id };
    mockReq.body = { title: 'updated' };

    await patchTicket()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(mockTicket.ticket_id, { title: 'updated' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updated);
  });
});
