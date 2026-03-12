import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { TicketWithHistory } from '../../../models/ticket';
import { TicketService } from '../../../services/ticket-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { getTicketForUser } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}', () => {
  const mockTicketWithHistory: TicketWithHistory = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_slug: '04900001',
    subject: 'A ticket',
    description: 'desc',
    team_id: '22222222-2222-2222-2222-222222222222',
    create_date: '2026-02-25T00:00:00.000Z',
    priority: 'medium',
    status: 'open',
    statuses: [
      {
        ticket_status_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: '11111111-1111-1111-1111-111111111111',
        user_identifier: 'user@example.com',
        create_date: '2026-02-25T00:00:00.000Z',
        status: 'open'
      }
    ],
    comments: [],
    references: [],
    data_requests: []
  };

  afterEach(() => {
    sinon.restore();
  });

  describe('getTicketForUser', () => {
    it('returns ticket details by ID with 200', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      const getTicketStub = sinon.stub(TicketService.prototype, 'getTicket').resolves(mockTicketWithHistory);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { ticketId: mockTicketWithHistory.ticket_id };

      await getTicketForUser()(mockReq, mockRes, mockNext);

      expect(getTicketStub).to.have.been.calledWith(mockTicketWithHistory.ticket_id);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockTicketWithHistory);
    });

    it('rolls back and rethrows on error', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fetchError = new Error('ticket not found');
      sinon.stub(TicketService.prototype, 'getTicket').rejects(fetchError);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { ticketId: mockTicketWithHistory.ticket_id };

      try {
        await getTicketForUser()(mockReq, mockRes, mockNext);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.equal(fetchError);
        expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
      }
    });
  });
});
