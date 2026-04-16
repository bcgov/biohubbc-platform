import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Comment } from '../models/comment';
import { CommentRepository } from '../repositories/comment-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CommentService } from './comment-service';

chai.use(sinonChai);

describe('CommentService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockComment: Comment = {
    comment_id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    comment: 'This is a test comment'
  };

  it('createComment delegates to CommentRepository', async () => {
    const mockDB = getMockDBConnection();
    const service = new CommentService(mockDB);

    const createStub = sinon.stub(CommentRepository.prototype, 'createComment').resolves(mockComment);
    const result = await service.createComment('This is a test comment');

    expect(createStub).to.have.been.calledOnceWith('This is a test comment');
    expect(result).to.deep.equal(mockComment);
  });
});
