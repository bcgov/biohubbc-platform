import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../../../database/db';
import { TicketComment } from '../../../../../../models/ticket-comment';
import { TicketCommentService } from '../../../../../../services/ticket-comment-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import { deleteTicketComment, updateTicketComment } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/comment/{ticketCommentId}', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';
  const ticketCommentId = '33333333-3333-3333-3333-333333333333';

  afterEach(() => {
    sinon.restore();
  });

  it('PUT updates a ticket comment', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const updatedComment: TicketComment = {
      ticket_comment_id: ticketCommentId,
      ticket_id: ticketId,
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z',
      comment: 'Updated comment'
    };

    const updateCommentStub = sinon
      .stub(TicketCommentService.prototype, 'updateTicketComment')
      .resolves(updatedComment);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketCommentId };
    mockReq.body = { comment: 'Updated comment' };

    await updateTicketComment()(mockReq, mockRes, mockNext);

    expect(updateCommentStub).to.have.been.calledWith({
      ticketId,
      ticketCommentId,
      comment: 'Updated comment'
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updatedComment);
  });

  it('DELETE removes a ticket comment', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const deleteCommentStub = sinon.stub(TicketCommentService.prototype, 'deleteTicketCommentByTicketId').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketCommentId };

    await deleteTicketComment()(mockReq, mockRes, mockNext);

    expect(deleteCommentStub).to.have.been.calledWith(ticketId, ticketCommentId);
    expect(mockRes.statusValue).to.equal(204);
  });
});
