import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TicketStatus } from '../models/ticket-status';
import { TicketStatusRepository } from '../repositories/ticket-status-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { TicketStatusService } from './ticket-status-service';

chai.use(sinonChai);

describe('TicketStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicketId = '11111111-1111-1111-1111-111111111111';

  const mockStatusRow: TicketStatus = {
    ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
    ticket_id: mockTicketId,
    user_identifier: 'Sarah',
    create_date: '2026-02-25T00:00:00.000Z',
    status: 'open'
  };

  describe('insertTicketStatus', () => {
    it('delegates insert to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketStatusService(mockDBConnection);

      const insertStub = sinon.stub(TicketStatusRepository.prototype, 'insertTicketStatus').resolves(mockStatusRow);

      const result = await service.insertTicketStatus(mockTicketId, 'open');

      expect(insertStub).to.have.been.calledOnceWith(mockTicketId, 'open');
      expect(result).to.eql(mockStatusRow);
    });

    it('propagates repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketStatusService(mockDBConnection);

      sinon.stub(TicketStatusRepository.prototype, 'insertTicketStatus').rejects(new Error('DB error'));

      try {
        await service.insertTicketStatus(mockTicketId, 'open');
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('DB error');
      }
    });
  });

  describe('getTicketStatus', () => {
    it('returns status rows from repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketStatusService(mockDBConnection);

      const getStub = sinon.stub(TicketStatusRepository.prototype, 'getTicketStatus').resolves([mockStatusRow]);

      const result = await service.getTicketStatus(mockTicketId);

      expect(getStub).to.have.been.calledOnceWith(mockTicketId);
      expect(result).to.eql([mockStatusRow]);
    });
  });
});
