import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { Ticket } from '../../../../../models/ticket';
import { TicketService } from '../../../../../services/ticket-service';
import { updateTicketStatus } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/status', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PUT status delegates to updateTicket with status payload', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const updatedTicket: Ticket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_slug: '04900001',
      subject: 'A ticket',
      description: 'desc',
      team_id: '22222222-2222-2222-2222-222222222222',
      create_date: '2026-02-25T00:00:00.000Z',
      priority: 'medium',
      status: 'closed'
    };

    const updateStub = sinon.stub(TicketService.prototype, 'updateTicket').resolves(updatedTicket);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: updatedTicket.ticket_id };
    mockReq.body = { status: 'closed' };

    await updateTicketStatus()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(updatedTicket.ticket_id, { status: 'closed' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updatedTicket);
  });
});
