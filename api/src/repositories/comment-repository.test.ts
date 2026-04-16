import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { Comment } from '../models/comment';
import { CommentRepository } from './comment-repository';

chai.use(sinonChai);

describe('CommentRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockComment: Comment = {
    comment_id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    comment: 'This is a test comment'
  };

  describe('findCommentsByDataRequestStatusId', () => {
    it('should return comments when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockComment]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CommentRepository(mockDBConnection);

      const result = await repo.findCommentsByDataRequestStatusId('c3d4e5f6-a7b8-9012-cdef-123456789012');

      expect(result).to.eql([mockComment]);
    });

    it('should return empty array when no comments found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CommentRepository(mockDBConnection);

      const result = await repo.findCommentsByDataRequestStatusId('c3d4e5f6-a7b8-9012-cdef-123456789012');

      expect(result).to.eql([]);
    });
  });

  describe('createComment', () => {
    it('should create and return a new comment', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockComment]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CommentRepository(mockDBConnection);

      const result = await repo.createComment('This is a test comment');

      expect(result).to.eql(mockComment);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CommentRepository(mockDBConnection);

      try {
        await repo.createComment('Test comment');
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to create comment');
      }
    });
  });

  describe('updateComment', () => {
    it('should update and return the comment', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockComment]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CommentRepository(mockDBConnection);

      const result = await repo.updateComment(mockComment.comment_id, { comment: mockComment.comment });

      expect(result).to.eql(mockComment);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CommentRepository(mockDBConnection);

      try {
        await repo.updateComment(mockComment.comment_id, { comment: 'Updated comment' });
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to update comment');
      }
    });
  });
});
