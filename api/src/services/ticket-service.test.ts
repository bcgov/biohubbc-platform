import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { IDBConnection } from '../database/db';
import { DataRequest } from '../models/data-request';
import { Team } from '../models/team';
import { Ticket, TicketFilters } from '../models/ticket';
import { TicketArtifact } from '../models/ticket-artifact';
import { TicketComment } from '../models/ticket-comment';
import { TicketReference } from '../models/ticket-reference';
import { TicketStatus } from '../models/ticket-status';
import { TicketCommentRepository } from '../repositories/ticket-comment-repository';
import { TicketRepository } from '../repositories/ticket-repository';
import { TeamService } from './access-policy/team-service';
import { DataRequestService } from './data-request-service';
import { TicketArtifactService } from './ticket-artifact-service';
import { TicketReferenceService } from './ticket-reference-service';
import { TicketService } from './ticket-service';
import { TicketStatusService } from './ticket-status-service';
import { TicketSystemUserService } from './ticket-system-user-service';

chai.use(sinonChai);

describe('TicketService', () => {
  let mockDBConnection: IDBConnection;
  let service: TicketService;

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
      const createdTicket: Ticket = { ...mockTicket, team_id: generatedTeamId };
      const getNextTicketSlugStub = sinon.stub(TicketRepository.prototype, 'getNextTicketSlug').resolves('04900001');
      const mockTeam: Team = {
        team_id: generatedTeamId,
        name: 'Auto Team',
        description: null,
        member_count: 0
      };
      const createTeamWithMembersStub = sinon.stub(TeamService.prototype, 'createTeam').resolves(mockTeam);
      const insertTicketStub = sinon.stub(TicketRepository.prototype, 'insertTicket').resolves(createdTicket);
      const insertHistoryStub = sinon.stub(TicketStatusService.prototype, 'insertTicketStatus').resolves();

      const result = await service.createTicket({ subject: 'A ticket', description: null, priority: 'medium' });

      expect(createTeamWithMembersStub).to.have.been.calledWith(
        sinon.match({
          name: sinon.match.string,
          description: 'Auto-generated team for ticket system users.',
          system_user_ids: []
        })
      );
      expect(getNextTicketSlugStub).to.have.been.calledOnce;
      expect(insertTicketStub).to.have.been.calledWith(
        sinon.match({
          subject: 'A ticket',
          description: null,
          priority: 'medium',
          team_id: generatedTeamId,
          ticket_slug: sinon.match(/^\d{8}$/)
        })
      );
      expect(insertHistoryStub).to.have.been.calledWith(createdTicket.ticket_id, 'open');
      expect(result).to.eql(createdTicket);
    });

    it('passes system user ids to createTeam when provided', async () => {
      const generatedTeamId = '99999999-9999-9999-9999-999999999999';
      const createdTicket: Ticket = { ...mockTicket, team_id: generatedTeamId };
      sinon.stub(TicketRepository.prototype, 'getNextTicketSlug').resolves('04900001');
      const mockTeam: Team = {
        team_id: generatedTeamId,
        name: 'Auto Team',
        description: null,
        member_count: 0
      };
      const createTeamStub = sinon.stub(TeamService.prototype, 'createTeam').resolves(mockTeam);
      sinon.stub(TicketRepository.prototype, 'insertTicket').resolves(createdTicket);
      sinon.stub(TicketStatusService.prototype, 'insertTicketStatus').resolves();

      const systemUserIds: number[] = [7, 8];
      await service.createTicket({ subject: 'A ticket', description: null, priority: 'medium', systemUserIds });

      expect(createTeamStub).to.have.been.calledWith(
        sinon.match({
          name: sinon.match.string,
          description: 'Auto-generated team for ticket system users.',
          system_user_ids: systemUserIds
        })
      );
    });

    it('throws when insert fails', async () => {
      sinon.stub(TicketRepository.prototype, 'getNextTicketSlug').resolves('04900001');
      const mockTeam: Team = {
        team_id: mockTicket.team_id,
        name: 'Auto Team',
        description: null,
        member_count: 0
      };
      sinon.stub(TeamService.prototype, 'createTeam').resolves(mockTeam);
      const insertError = new Error('insert failed');
      sinon.stub(TicketRepository.prototype, 'insertTicket').rejects(insertError);
      const insertHistoryStub = sinon.stub(TicketStatusService.prototype, 'insertTicketStatus').resolves();

      try {
        await service.createTicket({ subject: 'A ticket', description: 'desc', priority: 'medium' });
        expect.fail();
      } catch (error) {
        expect(error).to.equal(insertError);
        expect(insertHistoryStub).to.not.have.been.called;
      }
    });
  });

  describe('getTickets / getTicketsCount', () => {
    it('delegates to repository', async () => {
      const listStub = sinon.stub(TicketRepository.prototype, 'getTickets').resolves([mockTicket]);
      const countStub = sinon.stub(TicketRepository.prototype, 'getTicketsCount').resolves(1);

      const filters: TicketFilters = { team_ids: [mockTicket.team_id], status: 'open' };
      const list = await service.getTickets(filters, { page: 1, limit: 10 });
      const count = await service.getTicketsCount(filters);

      expect(listStub).to.have.been.calledWith(filters, { page: 1, limit: 10 });
      expect(countStub).to.have.been.calledWith(filters);
      expect(list).to.eql([mockTicket]);
      expect(count).to.equal(1);
    });
  });

  describe('getTicket', () => {
    it('returns ticket payload with separate status and comment logs when resolved by UUID', async () => {
      const statusLog: TicketStatus[] = [
        {
          ticket_status_id: '33333333-3333-3333-3333-333333333333',
          ticket_id: mockTicket.ticket_id,
          user_identifier: 'Sarah',
          create_date: '2026-02-25T00:00:00.000Z',
          status: 'open'
        }
      ];
      const commentLog: TicketComment[] = [
        {
          ticket_comment_id: '44444444-4444-4444-4444-444444444444',
          ticket_id: mockTicket.ticket_id,
          user_identifier: 'Bob',
          create_date: '2026-02-25T01:00:00.000Z',
          comment: 'New comment'
        }
      ];
      const artifactLog: TicketArtifact[] = [
        {
          ticket_artifact_id: '77777777-7777-4777-8777-777777777777',
          ticket_id: mockTicket.ticket_id,
          artifact_id: '88888888-8888-4888-8888-888888888888',
          record_end_date: null,
          create_date: '2026-02-25T01:30:00.000Z',
          key: 'tickets/abc/file.txt'
        }
      ];
      const referenceLog: TicketReference[] = [
        {
          ticket_reference_id: '55555555-5555-5555-5555-555555555555',
          source_ticket_id: mockTicket.ticket_id,
          source_ticket_slug: mockTicket.ticket_slug,
          source_ticket_subject: mockTicket.subject,
          target_ticket_id: '66666666-6666-6666-6666-666666666666',
          target_ticket_slug: '04900002',
          target_ticket_subject: 'Related ticket',
          relationship: 'relates_to',
          user_identifier: 'Bob',
          create_date: '2026-02-25T02:00:00.000Z'
        }
      ];
      const getTicketStub = sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket);
      const getStatusLogStub = sinon.stub(TicketStatusService.prototype, 'getTicketStatus').resolves(statusLog);
      const getCommentLogStub = sinon.stub(TicketCommentRepository.prototype, 'getTicketComments').resolves(commentLog);
      const getArtifactLogStub = sinon
        .stub(TicketArtifactService.prototype, 'getTicketArtifacts')
        .resolves(artifactLog);
      const getReferenceLogStub = sinon
        .stub(TicketReferenceService.prototype, 'getTicketReferencesForTicket')
        .resolves(referenceLog);
      const getDataRequestLogStub = sinon.stub(DataRequestService.prototype, 'findDataRequestsByTicketId').resolves([]);
      const getTicketSystemUsersStub = sinon
        .stub(TicketSystemUserService.prototype, 'getActiveTicketSystemUsersByTicketId')
        .resolves([]);

      const result = await service.getTicket(mockTicket.ticket_id);

      expect(getTicketStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getStatusLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getCommentLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getArtifactLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getReferenceLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getDataRequestLogStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(getTicketSystemUsersStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(result).to.eql({
        ...mockTicket,
        statuses: statusLog,
        comments: commentLog,
        artifacts: artifactLog,
        references: referenceLog,
        data_requests: [],
        ticket_system_users: []
      });
    });
  });

  describe('updateTicket', () => {
    it('delegates updates to repository', async () => {
      const updated: Ticket = { ...mockTicket, subject: 'new subject' };
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(updated);
      const historyStub = sinon.stub(TicketStatusService.prototype, 'insertTicketStatus').resolves();

      const result = await service.updateTicket(mockTicket.ticket_id, { subject: 'new subject' });

      expect(updateStub).to.have.been.calledWith(mockTicket.ticket_id, { subject: 'new subject' });
      expect(historyStub).to.not.have.been.called;
      expect(result).to.eql(updated);
    });

    it('delegates status updates to repository', async () => {
      const updated: Ticket = { ...mockTicket, status: 'closed' };
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(updated);
      const historyStub = sinon.stub(TicketStatusService.prototype, 'insertTicketStatus').resolves();
      const getDataRequestsStub = sinon.stub(DataRequestService.prototype, 'findDataRequestsByTicketId').resolves([]);

      const result = await service.updateTicket(mockTicket.ticket_id, { status: 'closed' });

      expect(getDataRequestsStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(updateStub).to.have.been.calledWith(mockTicket.ticket_id, { status: 'closed' });
      expect(historyStub).to.have.been.calledWith(mockTicket.ticket_id, 'closed');
      expect(result).to.eql(updated);
    });

    it('throws when attempting to close ticket with requested data requests', async () => {
      const updateStub = sinon
        .stub(TicketRepository.prototype, 'updateTicket')
        .resolves({ ...mockTicket, status: 'closed' });
      const historyStub = sinon.stub(TicketStatusService.prototype, 'insertTicketStatus').resolves();
      const dataRequest: DataRequest = {
        data_request_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        reason: 'Need access',
        team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        requested_by: 1,
        ticket_id: mockTicket.ticket_id,
        policy_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        status: 'requested',
        create_date: '2026-04-17T00:00:00.000Z'
      };
      const getDataRequestsStub = sinon
        .stub(DataRequestService.prototype, 'findDataRequestsByTicketId')
        .resolves([dataRequest]);

      try {
        await service.updateTicket(mockTicket.ticket_id, { status: 'closed' });
        expect.fail();
      } catch (error) {
        expect(getDataRequestsStub).to.have.been.calledWith(mockTicket.ticket_id);
        expect((error as Error).message).to.equal('Cannot close tickets that have unaddressed data requests');
        expect(updateStub).to.not.have.been.called;
        expect(historyStub).to.not.have.been.called;
      }
    });
  });

  describe('deleteTicket', () => {
    it('soft deletes an active ticket', async () => {
      const deleteStub = sinon.stub(TicketRepository.prototype, 'deleteTicket').resolves(mockTicket);
      const getDataRequestsStub = sinon.stub(DataRequestService.prototype, 'findDataRequestsByTicketId').resolves([]);

      await service.deleteTicket(mockTicket.ticket_id);

      expect(getDataRequestsStub).to.have.been.calledWith(mockTicket.ticket_id);
      expect(deleteStub).to.have.been.calledWith(mockTicket.ticket_id);
    });

    it('throws when deleting ticket with requested data requests', async () => {
      const deleteStub = sinon.stub(TicketRepository.prototype, 'deleteTicket').resolves(mockTicket);
      const dataRequest: DataRequest = {
        data_request_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        reason: 'Need access',
        team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        requested_by: 1,
        ticket_id: mockTicket.ticket_id,
        policy_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        status: 'requested',
        create_date: '2026-04-17T00:00:00.000Z'
      };
      sinon.stub(DataRequestService.prototype, 'findDataRequestsByTicketId').resolves([dataRequest]);

      try {
        await service.deleteTicket(mockTicket.ticket_id);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Cannot delete tickets that have unaddressed data requests');
        expect(deleteStub).to.not.have.been.called;
      }
    });

    it('throws when deleting ticket with reviewed data requests', async () => {
      const deleteStub = sinon.stub(TicketRepository.prototype, 'deleteTicket').resolves(mockTicket);
      const dataRequest: DataRequest = {
        data_request_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        reason: 'Need access',
        team_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        requested_by: 1,
        ticket_id: mockTicket.ticket_id,
        policy_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        status: 'reviewed',
        create_date: '2026-04-17T00:00:00.000Z'
      };
      sinon.stub(DataRequestService.prototype, 'findDataRequestsByTicketId').resolves([dataRequest]);

      try {
        await service.deleteTicket(mockTicket.ticket_id);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Cannot delete tickets that have unaddressed data requests');
        expect(deleteStub).to.not.have.been.called;
      }
    });
  });

  describe('createTicketReference', () => {
    it('creates ticket references for the source ticket', async () => {
      const createdReferences: TicketReference[] = [
        {
          ticket_reference_id: '77777777-7777-7777-7777-777777777777',
          source_ticket_id: mockTicket.ticket_id,
          source_ticket_slug: mockTicket.ticket_slug,
          source_ticket_subject: mockTicket.subject,
          target_ticket_id: '88888888-8888-8888-8888-888888888888',
          target_ticket_slug: '04900003',
          target_ticket_subject: 'Another ticket',
          relationship: 'relates_to',
          user_identifier: 'Sarah',
          create_date: '2026-02-25T00:00:00.000Z'
        },
        {
          ticket_reference_id: '99999999-9999-9999-9999-999999999999',
          source_ticket_id: mockTicket.ticket_id,
          source_ticket_slug: mockTicket.ticket_slug,
          source_ticket_subject: mockTicket.subject,
          target_ticket_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          target_ticket_slug: '04900004',
          target_ticket_subject: 'Yet another ticket',
          relationship: 'relates_to',
          user_identifier: 'Sarah',
          create_date: '2026-02-25T00:00:00.000Z'
        }
      ];
      const createReferenceStub = sinon
        .stub(TicketReferenceService.prototype, 'createTicketReference')
        .onFirstCall()
        .resolves(createdReferences[0])
        .onSecondCall()
        .resolves(createdReferences[1]);

      const result = await service.createTicketReference(mockTicket.ticket_id, {
        references: createdReferences.map((reference) => ({
          target_ticket_id: reference.target_ticket_id,
          relationship: reference.relationship
        }))
      });

      expect(createReferenceStub).to.have.been.calledWithMatch({
        source_ticket_id: mockTicket.ticket_id,
        target_ticket_id: createdReferences[0].target_ticket_id,
        relationship: createdReferences[0].relationship
      });
      expect(createReferenceStub).to.have.been.calledWithMatch({
        source_ticket_id: mockTicket.ticket_id,
        target_ticket_id: createdReferences[1].target_ticket_id,
        relationship: createdReferences[1].relationship
      });
      expect(result).to.eql(createdReferences);
    });
  });

  describe('deleteTicketReference', () => {
    it('deletes a ticket reference by id', async () => {
      const ticketReferenceId = '77777777-7777-7777-7777-777777777777';
      const deleteReferenceStub = sinon.stub(TicketReferenceService.prototype, 'deleteTicketReference').resolves();

      await service.deleteTicketReference(mockTicket.ticket_id, ticketReferenceId);

      expect(deleteReferenceStub).to.have.been.calledWith(mockTicket.ticket_id, ticketReferenceId);
    });
  });
});
