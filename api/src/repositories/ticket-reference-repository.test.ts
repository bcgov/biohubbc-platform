import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { TicketReference } from '../models/ticket-reference';
import { TicketReferenceRepository } from './ticket-reference-repository';

chai.use(sinonChai);

describe('TicketReferenceRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockSourceTicketId = '11111111-1111-1111-1111-111111111111';
  const mockTargetTicketId = '22222222-2222-2222-2222-222222222222';
  const mockTicketReferenceId = '33333333-3333-3333-3333-333333333333';

  describe('insertTicketReference', () => {
    it('throws when insert fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      try {
        await repo.insertTicketReference({
          source_ticket_id: mockSourceTicketId,
          target_ticket_id: mockTargetTicketId,
          relationship: 'relates_to'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to insert ticket reference');
        }
      }
    });

    it('returns inserted ticket_reference_id', async () => {
      const mockRow = { ticket_reference_id: mockTicketReferenceId };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      const result = await repo.insertTicketReference({
        source_ticket_id: mockSourceTicketId,
        target_ticket_id: mockTargetTicketId,
        relationship: 'relates_to'
      });
      expect(result).to.eql(mockRow);
    });
  });

  describe('getTicketReferenceById', () => {
    it('throws when not found', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      try {
        await repo.getTicketReferenceById(mockTicketReferenceId);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to get ticket reference');
        }
      }
    });

    it('returns a single ticket reference row', async () => {
      const mockRow: TicketReference = {
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
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      const result = await repo.getTicketReferenceById(mockTicketReferenceId);
      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteTicketReference', () => {
    it('throws when delete fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      try {
        await repo.deleteTicketReference(mockSourceTicketId, mockTicketReferenceId);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to delete ticket reference');
        }
      }
    });

    it('returns deleted ticket_reference_id', async () => {
      const mockRow = { ticket_reference_id: mockTicketReferenceId };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      const result = await repo.deleteTicketReference(mockSourceTicketId, mockTicketReferenceId);
      expect(result).to.eql(mockRow);
    });
  });

  describe('getTicketReferencesForTicket', () => {
    it('returns reference rows ordered by query', async () => {
      const rows: TicketReference[] = [
        {
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
        }
      ];
      const mockQueryResponse = Promise.resolve(mockQueryResult(rows));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketReferenceRepository(mockDBConnection);

      const result = await repo.getTicketReferencesForTicket(mockSourceTicketId);
      expect(result).to.eql(rows);
    });
  });
});
