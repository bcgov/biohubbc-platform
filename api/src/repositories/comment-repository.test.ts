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

  it('createComment inserts one row', async () => {
    const mockQueryResponse = { rowCount: 1, rows: [mockComment] } as unknown as QueryResult<any>;
    const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });
    const repo = new CommentRepository(mockDBConnection);

    const result = await repo.createComment('This is a test comment');
    expect(result).to.eql(mockComment);
  });

  it('updateComment updates and returns the row', async () => {
    const mockQueryResponse = { rowCount: 1, rows: [mockComment] } as unknown as QueryResult<any>;
    const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });
    const repo = new CommentRepository(mockDBConnection);

    const result = await repo.updateComment(mockComment.comment_id, { comment: 'Updated comment' });

    expect(result).to.eql(mockComment);
  });
});
