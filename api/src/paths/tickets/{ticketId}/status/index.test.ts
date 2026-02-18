import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { TicketService } from '../../../../services/ticket-service';
import { updateTicketStatus } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}/status', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('POST status delegates to updateTicket with status payload', async () => {
    const mockDBConnection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const updatedTicket = {
      ticket_id: '11111111-1111-1111-1111-111111111111',
      ticket_number: 1,
      title: 'A ticket',
      description: 'desc',
      team_id: '22222222-2222-2222-2222-222222222222',
      priority: 'MEDIUM' as const,
      status: 'CLOSED' as const
    };

    const updateStub = sinon.stub(TicketService.prototype, 'updateTicket').resolves(updatedTicket as any);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: updatedTicket.ticket_id };
    mockReq.body = { status: 'CLOSED' };

    await updateTicketStatus()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledWith(updatedTicket.ticket_id, { status: 'CLOSED' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updatedTicket);
  });
});
