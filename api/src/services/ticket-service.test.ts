import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IDBConnection } from '../database/db';
import { getMockDBConnection } from '../__mocks__/db';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketService } from './ticket-service';

chai.use(sinonChai);

describe('TicketService', () => {
  let mockDBConnection: IDBConnection;
  let service: TicketService;

  const mockTicket = {
    ticket_id: '11111111-1111-1111-1111-111111111111',
    ticket_number: 1,
    title: 'A ticket',
    description: 'desc',
    team_id: '22222222-2222-2222-2222-222222222222',
    priority: 'MEDIUM' as const,
    status: 'OPEN' as const
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new TicketService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createTicket', () => {
    it('creates ticket and inserts initial status history', async () => {
      const insertTicketStub = sinon.stub(TicketRepository.prototype, 'insertTicket').resolves(mockTicket as any);
      const insertHistoryStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.createTicket({ title: 'A ticket', team_id: mockTicket.team_id });

      expect(insertTicketStub).to.have.been.calledOnce;
      expect(insertHistoryStub).to.have.been.calledWith(mockTicket.ticket_id, 'OPEN');
      expect(result).to.eql(mockTicket);
    });
  });

  describe('getTicketsByTeamId / getTicketsByTeamIdCount', () => {
    it('delegates to repository', async () => {
      const listStub = sinon.stub(TicketRepository.prototype, 'getTicketsByTeamId').resolves([mockTicket as any]);
      const countStub = sinon.stub(TicketRepository.prototype, 'getTicketsByTeamIdCount').resolves(1);

      const list = await service.getTicketsByTeamId(mockTicket.team_id, 'OPEN', { page: 1, limit: 10 });
      const count = await service.getTicketsByTeamIdCount(mockTicket.team_id, 'OPEN');

      expect(listStub).to.have.been.calledWith(mockTicket.team_id, 'OPEN', { page: 1, limit: 10 });
      expect(countStub).to.have.been.calledWith(mockTicket.team_id, 'OPEN');
      expect(list).to.eql([mockTicket]);
      expect(count).to.equal(1);
    });
  });

  describe('updateTicket', () => {
    it('returns current ticket when status unchanged', async () => {
      const getStub = sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(mockTicket as any);
      const historyStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.updateTicket(mockTicket.ticket_id, { status: 'OPEN' });

      expect(getStub).to.have.been.calledOnce;
      expect(updateStub).to.not.have.been.called;
      expect(historyStub).to.not.have.been.called;
      expect(result).to.eql(mockTicket);
    });

    it('updates and inserts status history when status changes', async () => {
      const updated = { ...mockTicket, status: 'CLOSED' as const };
      sinon.stub(TicketRepository.prototype, 'getTicketById').resolves(mockTicket as any);
      const updateStub = sinon.stub(TicketRepository.prototype, 'updateTicket').resolves(updated as any);
      const historyStub = sinon.stub(TicketRepository.prototype, 'insertTicketStatusHistory').resolves({} as any);

      const result = await service.updateTicket(mockTicket.ticket_id, { status: 'CLOSED' });

      expect(updateStub).to.have.been.calledWith(mockTicket.ticket_id, { status: 'CLOSED' });
      expect(historyStub).to.have.been.calledWith(mockTicket.ticket_id, 'CLOSED');
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
