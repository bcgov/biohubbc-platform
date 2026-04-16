import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { Ticket } from '../../models/ticket';
import { TeamMemberService } from '../../services/access-policy/team-member-service';
import { TicketService } from '../../services/ticket-service';
import { getTicketsForUser } from './index';

chai.use(sinonChai);

describe('paths/tickets', () => {
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

  describe('getTicketsForUser', () => {
    it('resolves team IDs for the current user and returns their tickets', async () => {
      const systemUserId = 7;
      const teamIds = [mockTicket.team_id];

      const mockDBConnection = getMockDBConnection({
        systemUserId: () => systemUserId,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const getTeamIdsStub = sinon.stub(TeamMemberService.prototype, 'getTeamIdsBySystemUserId').resolves(teamIds);
      const listStub = sinon.stub(TicketService.prototype, 'getTickets').resolves([mockTicket]);
      const countStub = sinon.stub(TicketService.prototype, 'getTicketsCount').resolves(1);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { status: 'open', page: '1', limit: '10' };

      await getTicketsForUser()(mockReq, mockRes, mockNext);

      expect(getTeamIdsStub).to.have.been.calledWith(systemUserId);
      expect(listStub).to.have.been.calledWithMatch(
        { team_ids: teamIds, status: 'open', search: undefined },
        sinon.match.object
      );
      expect(countStub).to.have.been.calledWithMatch({ team_ids: teamIds, status: 'open', search: undefined });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.tickets).to.eql([mockTicket]);
      expect(mockRes.jsonValue.pagination.total).to.equal(1);
    });

    it('returns an empty list when the user has no team memberships', async () => {
      const systemUserId = 99;

      const mockDBConnection = getMockDBConnection({
        systemUserId: () => systemUserId,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(TeamMemberService.prototype, 'getTeamIdsBySystemUserId').resolves([]);
      const listStub = sinon.stub(TicketService.prototype, 'getTickets').resolves([]);
      const countStub = sinon.stub(TicketService.prototype, 'getTicketsCount').resolves(0);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { page: '1', limit: '10' };

      await getTicketsForUser()(mockReq, mockRes, mockNext);

      expect(listStub).to.have.been.calledWithMatch({ team_ids: [] });
      expect(countStub).to.have.been.calledWithMatch({ team_ids: [] });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.tickets).to.eql([]);
      expect(mockRes.jsonValue.pagination.total).to.equal(0);
    });

    it('rolls back and rethrows on error', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => 1,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fetchError = new Error('service failure');
      sinon.stub(TeamMemberService.prototype, 'getTeamIdsBySystemUserId').rejects(fetchError);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {};

      try {
        await getTicketsForUser()(mockReq, mockRes, mockNext);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.equal(fetchError);
        expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
      }
    });
  });
});
