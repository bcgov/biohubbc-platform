import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { TicketService } from '../../../../services/ticket-service';
import { getTicketStatusHistory } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}/status-history', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('GET returns status history rows', async () => {
    const mockDBConnection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const history = [
      {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        status: 'CLOSED' as const
      }
    ];

    sinon.stub(TicketService.prototype, 'getTicketStatusHistory').resolves(history as any);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: '11111111-1111-1111-1111-111111111111' };

    await getTicketStatusHistory()(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(history);
  });
});
