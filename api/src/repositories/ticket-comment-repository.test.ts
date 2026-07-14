import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { TicketCommentRepository } from './ticket-comment-repository';

chai.use(sinonChai);

describe('TicketCommentRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicketId = '11111111-1111-1111-1111-111111111111';

  describe('insertTicketComment', () => {
    it('throws when insert fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      try {
        await repo.insertTicketComment(mockTicketId, '44444444-4444-4444-4444-444444444444');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to insert ticket comment');
        }
      }
    });

    it('returns inserted ticket_comment_id', async () => {
      const mockRow = {
        ticket_comment_id: '33333333-3333-3333-3333-333333333333'
      };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      const result = await repo.insertTicketComment(mockTicketId, '44444444-4444-4444-4444-444444444444');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getTicketCommentById', () => {
    it('throws when not found', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      try {
        await repo.getTicketCommentById(mockTicketId, '33333333-3333-3333-3333-333333333333');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to get ticket comment');
        }
      }
    });

    it('returns a single comment row', async () => {
      const mockRow = {
        ticket_comment_id: '33333333-3333-3333-3333-333333333333',
        ticket_id: mockTicketId,
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z',
        comment: 'New comment',
        artifacts: []
      };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      const result = await repo.getTicketCommentById(mockTicketId, '33333333-3333-3333-3333-333333333333');
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateTicketComment', () => {
    it('throws when update fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      try {
        await repo.updateTicketComment(mockTicketId, '33333333-3333-3333-3333-333333333333', 'Updated comment');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to update ticket comment');
        }
      }
    });

    it('returns updated comment_id', async () => {
      const mockRow = {
        comment_id: '44444444-4444-4444-4444-444444444444'
      };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      const result = await repo.updateTicketComment(
        mockTicketId,
        '33333333-3333-3333-3333-333333333333',
        'Updated comment'
      );
      expect(result).to.eql(mockRow);
    });
  });

  describe('deleteTicketComment', () => {
    it('throws when delete fails', async () => {
      const mockQueryResponse = Promise.resolve(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      try {
        await repo.deleteTicketComment(mockTicketId, '33333333-3333-3333-3333-333333333333');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        if (error instanceof ApiExecuteSQLError) {
          expect(error.message).to.equal('Failed to delete ticket comment');
        }
      }
    });

    it('returns deleted ticket_comment_id', async () => {
      const mockRow = {
        ticket_comment_id: '33333333-3333-3333-3333-333333333333'
      };
      const mockQueryResponse = Promise.resolve(mockQueryResult([mockRow]));
      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      const result = await repo.deleteTicketComment(mockTicketId, '33333333-3333-3333-3333-333333333333');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getTicketComments', () => {
    it('returns comment rows ordered by query', async () => {
      const rows = [
        {
          ticket_comment_id: '33333333-3333-3333-3333-333333333333',
          ticket_id: mockTicketId,
          user_identifier: 'Sarah',
          create_date: '2026-02-25T00:00:00.000Z',
          comment: 'New comment',
          artifacts: []
        }
      ];
      const mockQueryResponse = Promise.resolve(mockQueryResult(rows));
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new TicketCommentRepository(mockDBConnection);

      const result = await repo.getTicketComments(mockTicketId);
      expect(result).to.eql(rows);
    });
  });
});
