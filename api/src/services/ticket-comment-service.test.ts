import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { Comment } from '../models/comment';
import { TicketComment } from '../models/ticket-comment';
import { CommentRepository } from '../repositories/comment-repository';
import { TicketCommentRepository } from '../repositories/ticket-comment-repository';
import { TicketCommentArtifactService } from './ticket-comment-artifact-service';
import { TicketCommentService } from './ticket-comment-service';

chai.use(sinonChai);

describe('TicketCommentService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockTicketId = '11111111-1111-1111-1111-111111111111';
  const mockTicketCommentId = '33333333-3333-3333-3333-333333333333';

  const mockComment: Comment = {
    comment_id: '44444444-4444-4444-4444-444444444444',
    comment: 'New comment'
  };

  const mockTicketComment: TicketComment = {
    ticket_comment_id: mockTicketCommentId,
    ticket_id: mockTicketId,
    user_identifier: 'Sarah',
    create_date: '2026-02-25T00:00:00.000Z',
    comment: 'New comment',
    artifacts: []
  };

  describe('createTicketComment', () => {
    it('creates comment, links it to ticket, and returns comment row', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketCommentService(mockDBConnection);

      const createCommentStub = sinon.stub(CommentRepository.prototype, 'createComment').resolves(mockComment);
      const insertTicketCommentStub = sinon
        .stub(TicketCommentRepository.prototype, 'insertTicketComment')
        .resolves({ ticket_comment_id: mockTicketCommentId });
      const getTicketCommentByIdStub = sinon
        .stub(TicketCommentRepository.prototype, 'getTicketCommentById')
        .resolves(mockTicketComment);
      const replaceTicketCommentArtifactsStub = sinon
        .stub(TicketCommentArtifactService.prototype, 'replaceTicketCommentArtifacts')
        .resolves();

      const comment = 'New comment [file](/artifact/55555555-5555-4555-8555-555555555555)';
      const result = await service.createTicketComment({ ticketId: mockTicketId, comment });

      expect(createCommentStub).to.have.been.calledOnceWith(comment);
      expect(insertTicketCommentStub).to.have.been.calledOnceWith(mockTicketId, mockComment.comment_id);
      expect(replaceTicketCommentArtifactsStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId, [
        '55555555-5555-4555-8555-555555555555'
      ]);
      expect(getTicketCommentByIdStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId);
      expect(result).to.eql(mockTicketComment);
    });

    it('propagates repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketCommentService(mockDBConnection);

      sinon.stub(CommentRepository.prototype, 'createComment').rejects(new Error('DB error'));

      try {
        await service.createTicketComment({ ticketId: mockTicketId, comment: 'New comment' });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('DB error');
      }
    });
  });

  describe('deleteTicketComment', () => {
    it('delegates delete to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketCommentService(mockDBConnection);

      const deleteStub = sinon
        .stub(TicketCommentRepository.prototype, 'deleteTicketComment')
        .resolves({ ticket_comment_id: mockTicketCommentId });
      const deleteArtifactsStub = sinon
        .stub(TicketCommentArtifactService.prototype, 'deleteTicketCommentArtifacts')
        .resolves();

      await service.deleteTicketComment(mockTicketId, mockTicketCommentId);

      expect(deleteStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId);
      expect(deleteArtifactsStub).to.have.been.calledOnceWith(mockTicketCommentId);
    });
  });

  describe('updateTicketComment', () => {
    it('updates comment body and returns updated ticket comment row', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketCommentService(mockDBConnection);
      const updateTicketCommentStub = sinon
        .stub(TicketCommentRepository.prototype, 'updateTicketComment')
        .resolves({ comment_id: '44444444-4444-4444-4444-444444444444' });
      const replaceTicketCommentArtifactsStub = sinon
        .stub(TicketCommentArtifactService.prototype, 'replaceTicketCommentArtifacts')
        .resolves();
      const getTicketCommentByIdStub = sinon.stub(TicketCommentRepository.prototype, 'getTicketCommentById').resolves({
        ...mockTicketComment,
        comment: 'Updated comment'
      });
      const comment = 'Updated comment ![image](/artifact/55555555-5555-4555-8555-555555555555)';

      const result = await service.updateTicketComment({
        ticketId: mockTicketId,
        ticketCommentId: mockTicketCommentId,
        comment
      });

      expect(updateTicketCommentStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId, comment);
      expect(replaceTicketCommentArtifactsStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId, [
        '55555555-5555-4555-8555-555555555555'
      ]);
      expect(getTicketCommentByIdStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId);
      expect(result.comment).to.equal('Updated comment');
    });
  });

  describe('deleteTicketCommentByTicketId', () => {
    it('verifies ticket linkage before deleting comment link', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketCommentService(mockDBConnection);

      const getByIdStub = sinon
        .stub(TicketCommentRepository.prototype, 'getTicketCommentById')
        .resolves(mockTicketComment);
      const deleteStub = sinon
        .stub(TicketCommentRepository.prototype, 'deleteTicketComment')
        .resolves({ ticket_comment_id: mockTicketCommentId });
      const deleteArtifactsStub = sinon
        .stub(TicketCommentArtifactService.prototype, 'deleteTicketCommentArtifacts')
        .resolves();

      await service.deleteTicketCommentByTicketId(mockTicketId, mockTicketCommentId);

      expect(getByIdStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId);
      expect(deleteStub).to.have.been.calledOnceWith(mockTicketId, mockTicketCommentId);
      expect(deleteArtifactsStub).to.have.been.calledOnceWith(mockTicketCommentId);
    });
  });

  describe('getTicketComments', () => {
    it('returns ticket comments from repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new TicketCommentService(mockDBConnection);

      const getCommentsStub = sinon
        .stub(TicketCommentRepository.prototype, 'getTicketComments')
        .resolves([mockTicketComment]);

      const result = await service.getTicketComments(mockTicketId);

      expect(getCommentsStub).to.have.been.calledOnceWith(mockTicketId);
      expect(result).to.eql([mockTicketComment]);
    });
  });
});
