import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../database/db';
import { TicketRepository } from '../repositories/ticket-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { TeamService } from './access-policy/team-service';
import { TicketService } from './ticket-service';

chai.use(sinonChai);

describe('TicketService', () => {
  let mockDBConnection: IDBConnection;
  let service: TicketService;

  const mockTicket = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_slug: '04900001',
    title: 'A ticket',
    description: 'desc',
    team_id: '22222222-2222-2222-2222-222222222222',
    create_date: '2026-02-25T00:00:00.000Z',
    priority: 'medium' as const,
    status: 'open' as const
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TicketService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createTicket', () => {
    it('creates team, ticket and initial status history', async () => {
      const generatedTeamId = '99999999-9999-9999-9999-999999999999';
      const createdTicket = { ...mockTicket, team_id: generatedTeamId };
      const getNextTicketSlugStub = sinon.stub(TicketRepository.prototype, 'getNextTicketSlug').resolves('04900001');
      const createTeamWithMembersStub = sinon
        .stub(TeamService.prototype, 'createTeamWithMembers')
        .resolves({ team_id: generatedTeamId, name: 'Auto Team', description: null, members: [] } as any);
      const insertTicketStub = sinon.stub(TicketRepository.prototype, 'insertTicket').resolves(createdTicket as any);
      const insertHistoryStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.createTicket({ title: 'A ticket', description: null, priority: 'medium' });

      expect(createTeamWithMembersStub).to.have.been.calledWith(
        sinon.match({
          name: sinon.match.string,
          description: 'Auto-generated team for ticket ownership.'
        }),
        []
      );
      expect(getNextTicketSlugStub).to.have.been.calledOnce;
      expect(insertTicketStub).to.have.been.calledWith(
        sinon.match({
          title: 'A ticket',
          description: null,
          priority: 'medium',
          team_id: generatedTeamId,
          ticket_slug: sinon.match(/^\d{8}$/)
        })
      );
      expect(insertHistoryStub).to.have.been.calledWith(createdTicket.ticket_id, 'open');
      expect(result).to.eql(createdTicket);
    });

    it('throws when insert fails', async () => {
      sinon.stub(TicketRepository.prototype, 'getNextTicketSlug').resolves('04900001');
      sinon
        .stub(TeamService.prototype, 'createTeamWithMembers')
        .resolves({ team_id: mockTicket.team_id, members: [] } as any);
      const insertError = new Error('insert failed');
      sinon.stub(TicketRepository.prototype, 'insertTicket').rejects(insertError);
      const insertHistoryStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      try {
        await service.createTicket({ title: 'A ticket', description: 'desc', priority: 'medium' });
        expect.fail();
      } catch (error) {
        expect(error).to.equal(insertError);
        expect(insertHistoryStub).to.not.have.been.called;
      }
    });
  });

  describe('getTicketsByTeamId / getTicketsByTeamIdCount', () => {
    it('delegates to repository', async () => {
      const listStub = sinon.stub(TicketRepository.prototype, 'getTicketsByTeamId').resolves([mockTicket as any]);
      const countStub = sinon.stub(TicketRepository.prototype, 'getTicketsByTeamIdCount').resolves(1);

      const filters = { status: 'open' as const };
      const list = await service.getTicketsByTeamId(mockTicket.team_id, filters, { page: 1, limit: 10 });
      const count = await service.getTicketsByTeamIdCount(mockTicket.team_id, filters);

      expect(listStub).to.have.been.calledWith(mockTicket.team_id, filters, { page: 1, limit: 10 });
      expect(countStub).to.have.been.calledWith(mockTicket.team_id, filters);
      expect(list).to.eql([mockTicket]);
      expect(count).to.equal(1);
    });
  });

  describe('getTicket', () => {
    it('returns ticket payload with separate status and comment logs when resolved by UUID', async () => {
      const statusLog = [
        {
          ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
          ticket_id: mockTicket.ticket_id,
          user_identifier: 'Sarah',
          create_date: '2026-02-25T00:00:00.000Z',
          status: 'open' as const
        }
      ];
      const commentLog = [
        {
          ticket_comment_id: '44444444-4444-4444-4444-444444444444',
          ticket_id: mockTicket.ticket_id,
          user_identifier: 'Bob',
          create_date: '2026-02-25T01:00:00.000Z',
          comment: 'New comment'
        }
      ];
      const getTicketStub = sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const getStatusLogStub = sinon
        .stub(TicketRepository.prototype, 'getTicketStatusHistory')
        .resolves(statusLog as any);
      const getCommentLogStub = sinon.stub(TicketRepository.prototype, 'getTicketCommentLog').resolves(commentLog as any);

      const result = await service.getTicket(mockTicket.ticket_id);

      expect(getTicketStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getStatusLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getCommentLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(result).to.eql({ ...mockTicket, status_log: statusLog, comment_log: commentLog });
    });
  });

  describe('createTicketComment', () => {
    it('creates a comment history item for the ticket', async () => {
      const createdHistoryItem = {
        ticket_status_history_id: null,
        ticket_comment_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: mockTicket.ticket_id,
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z',
        status: null,
        comment: 'New comment'
      };
      const getTicketStub = sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const insertCommentStub = sinon
        .stub(TicketRepository.prototype, 'insertTicketComment')
        .resolves(createdHistoryItem as any);

      const result = await service.createTicketComment(mockTicket.ticket_id, { comment: 'New comment' });

      expect(getTicketStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(insertCommentStub).to.have.been.calledWith(mockTicket.ticket_id, { comment: 'New comment' });
      expect(result).to.eql(createdHistoryItem);
    });
  });

  describe('updateTicket', () => {
    it('returns current ticket when status unchanged', async () => {
      const getStub = sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(mockTicket as any);
      const historyStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.updateTicket(mockTicket.ticket_id, { status: 'open' });

      expect(getStub).to.have.been.calledOnce;
      expect(updateStub).to.not.have.been.called;
      expect(historyStub).to.not.have.been.called;
      expect(result).to.eql(mockTicket);
    });

    it('updates and inserts status history when status changes', async () => {
      const updated = { ...mockTicket, status: 'closed' as const };
      sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(updated as any);
      const historyStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.updateTicket(mockTicket.ticket_id, { status: 'closed' });

      expect(updateStub).to.have.been.calledWith(mockTicket.ticket_id, { status: 'closed' });
      expect(historyStub).to.have.been.calledWith(mockTicket.ticket_id, 'closed');
      expect(result).to.eql(updated);
    });

    it('updates without status history when non-status fields change', async () => {
      const updated = { ...mockTicket, title: 'new title' };
      sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(updated as any);
      const historyStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.updateTicket(mockTicket.ticket_id, { title: 'new title' });

      expect(updateStub).to.have.been.calledWith(mockTicket.ticket_id, { title: 'new title' });
      expect(historyStub).to.not.have.been.called;
      expect(result).to.eql(updated);
    });
  });
});
