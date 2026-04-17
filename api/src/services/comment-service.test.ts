import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { Comment } from '../models/comment';
import { CommentRepository } from '../repositories/comment-repository';
import { DataRequestStatusRepository } from '../repositories/data-request-status-repository';
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

  const mockDataRequestStatusId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  describe('findCommentsByDataRequestStatusId', () => {
    it('should return comments for a given dataRequestStatusId', async () => {
      const mockDB = getMockDBConnection();
      const service = new CommentService(mockDB);

      const stub = sinon.stub(CommentRepository.prototype, 'findCommentsByDataRequestStatusId').resolves([mockComment]);

      const result = await service.findCommentsByDataRequestStatusId(mockDataRequestStatusId);

      expect(stub).to.have.been.calledOnceWith(mockDataRequestStatusId);
      expect(result).to.deep.equal([mockComment]);
    });

    it('should return empty array when no comments found', async () => {
      const mockDB = getMockDBConnection();
      const service = new CommentService(mockDB);

      sinon.stub(CommentRepository.prototype, 'findCommentsByDataRequestStatusId').resolves([]);

      const result = await service.findCommentsByDataRequestStatusId(mockDataRequestStatusId);

      expect(result).to.deep.equal([]);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CommentService(mockDB);

      sinon.stub(CommentRepository.prototype, 'findCommentsByDataRequestStatusId').rejects(new Error('DB error'));

      try {
        await service.findCommentsByDataRequestStatusId(mockDataRequestStatusId);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });

  describe('createCommentForDataRequestStatus', () => {
    it('should create comment and link it to data request status', async () => {
      const mockDB = getMockDBConnection();
      const service = new CommentService(mockDB);

      const createStub = sinon.stub(CommentRepository.prototype, 'createComment').resolves(mockComment);
      const updateStub = sinon.stub(DataRequestStatusRepository.prototype, 'updateDataRequestStatus').resolves();

      const result = await service.createCommentForDataRequestStatus('This is a test comment', mockDataRequestStatusId);

      expect(createStub).to.have.been.calledOnceWith('This is a test comment');
      expect(updateStub).to.have.been.calledOnceWith(mockDataRequestStatusId, {
        comment_id: mockComment.comment_id
      });
      expect(result).to.deep.equal(mockComment);
    });

    it('should call both repositories in correct order', async () => {
      const mockDB = getMockDBConnection();
      const service = new CommentService(mockDB);

      const createStub = sinon.stub(CommentRepository.prototype, 'createComment').resolves(mockComment);
      const updateStub = sinon.stub(DataRequestStatusRepository.prototype, 'updateDataRequestStatus').resolves();

      await service.createCommentForDataRequestStatus('Test', mockDataRequestStatusId);

      expect(createStub).to.have.been.calledBefore(updateStub);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CommentService(mockDB);

      sinon.stub(CommentRepository.prototype, 'createComment').rejects(new Error('DB error'));

      try {
        await service.createCommentForDataRequestStatus('Test', mockDataRequestStatusId);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal('DB error');
      }
    });
  });
});
