import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../../database/db';
import { TicketComment } from '../../../../../models/ticket-comment';
import { TicketCommentService } from '../../../../../services/ticket-comment-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { createTicketComment } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/comment', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';

  afterEach(() => {
    sinon.restore();
  });

  it('POST creates a ticket comment', async () => {
    const createdComment: TicketComment = {
      ticket_comment_id: '33333333-3333-3333-3333-333333333333',
      ticket_id: ticketId,
      user_identifier: 'Sarah',
      create_date: '2026-02-25T00:00:00.000Z',
      comment: 'A comment'
    };

    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createCommentStub = sinon
      .stub(TicketCommentService.prototype, 'createTicketComment')
      .resolves(createdComment);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId };
    mockReq.body = { comment: 'A comment' };

    await createTicketComment()(mockReq, mockRes, mockNext);

    expect(createCommentStub).to.have.been.calledWith({
      ticketId,
      comment: 'A comment'
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(createdComment);
  });
});
