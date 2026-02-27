import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../errors/api-error';
import { TicketStatus } from '../models/ticket-status';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { TicketStatusRepository } from './ticket-status-repository';

chai.use(sinonChai);

describe('TicketStatusRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicketId = '11111111-1111-1111-1111-111111111111';

  describe('insertTicketStatus', () => {
    it('throws when insert fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketStatusRepository(mockDBConnection);

      try {
        await repo.insertTicketStatus(mockTicketId, 'open');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to insert ticket status');
        }
      }
    });

    it('returns inserted status history row', async () => {
      const mockRow: TicketStatus = {
        ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: mockTicketId,
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z',
        status: 'open'
      };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketStatusRepository(mockDBConnection);

      const result = await repo.insertTicketStatus(mockTicketId, 'open');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getTicketStatus', () => {
    it('returns rows ordered by query', async () => {
      const rows: TicketStatus[] = [
        {
          ticket_status_history_id: '33333333-3333-3333-3333-333333333333',
          ticket_id: mockTicketId,
          user_identifier: 'Sarah',
          create_date: '2026-02-25T00:00:00.000Z',
          status: 'open'
        }
      ];
      const mockQueryResponse = Promise.resolve(mockQueryResult(rows));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketStatusRepository(mockDBConnection);

      const result = await repo.getTicketStatus(mockTicketId);
      expect(result).to.eql(rows);
    });
  });
});
