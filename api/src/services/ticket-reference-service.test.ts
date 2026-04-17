import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { TicketReference } from '../models/ticket-reference';
import { TicketReferenceRepository } from '../repositories/ticket-reference-repository';
import { TicketReferenceService } from './ticket-reference-service';

chai.use(sinonChai);

describe('TicketReferenceService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockSourceTicketId = '11111111-1111-1111-1111-111111111111';
  const mockTargetTicketId = '22222222-2222-2222-2222-222222222222';
  const mockTicketReferenceId = '33333333-3333-3333-3333-333333333333';

  const mockTicketReference: TicketReference = {
    ticket_reference_id: mockTicketReferenceId,
    source_ticket_id: mockSourceTicketId,
    source_ticket_slug: '04900001',
    source_ticket_subject: 'Source ticket',
    target_ticket_id: mockTargetTicketId,
    target_ticket_slug: '04900002',
    target_ticket_subject: 'Target ticket',
    relationship: 'relates_to',
    user_identifier: 'Sarah',
    create_date: '2026-02-25T00:00:00.000Z'
  };

  describe('createTicketReference', () => {
    it('creates a reference and returns reference row', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketReferenceService(mockDBConnection);

      const insertStub = sinon
        .stub(TicketReferenceRepository.prototype, 'insertTicketReference')
        .resolves({ ticket_reference_id: mockTicketReferenceId });
      const getByIdStub = sinon
        .stub(TicketReferenceRepository.prototype, 'getTicketReferenceById')
        .resolves(mockTicketReference);

      const result = await service.createTicketReference({
        source_ticket_id: mockSourceTicketId,
        target_ticket_id: mockTargetTicketId,
        relationship: 'relates_to'
      });

      expect(insertStub).to.have.been.calledOnceWith({
        source_ticket_id: mockSourceTicketId,
        target_ticket_id: mockTargetTicketId,
        relationship: 'relates_to'
      });
      expect(getByIdStub).to.have.been.calledOnceWith(mockTicketReferenceId);
      expect(result).to.eql(mockTicketReference);
    });

    it('propagates repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketReferenceService(mockDBConnection);

      sinon.stub(TicketReferenceRepository.prototype, 'insertTicketReference').rejects(new Error('DB error'));

      try {
        await service.createTicketReference({
          source_ticket_id: mockSourceTicketId,
          target_ticket_id: mockTargetTicketId,
          relationship: 'relates_to'
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('DB error');
      }
    });
  });

  describe('deleteTicketReference', () => {
    it('delegates delete to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketReferenceService(mockDBConnection);

      const deleteStub = sinon
        .stub(TicketReferenceRepository.prototype, 'deleteTicketReference')
        .resolves({ ticket_reference_id: mockTicketReferenceId });

      await service.deleteTicketReference(mockSourceTicketId, mockTicketReferenceId);

      expect(deleteStub).to.have.been.calledOnceWith(mockSourceTicketId, mockTicketReferenceId);
    });
  });

  describe('getTicketReferencesForTicket', () => {
    it('returns ticket references from repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketReferenceService(mockDBConnection);

      const getReferencesStub = sinon
        .stub(TicketReferenceRepository.prototype, 'getTicketReferencesForTicket')
        .resolves([mockTicketReference]);

      const result = await service.getTicketReferencesForTicket(mockSourceTicketId);

      expect(getReferencesStub).to.have.been.calledOnceWith(mockSourceTicketId);
      expect(result).to.eql([mockTicketReference]);
    });
  });
});
