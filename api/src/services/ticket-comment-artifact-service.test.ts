import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { TicketCommentArtifactRepository } from '../repositories/ticket-comment-artifact-repository';
import { TicketCommentArtifactService } from './ticket-comment-artifact-service';

chai.use(sinonChai);

describe('TicketCommentArtifactService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const ticketId = '11111111-1111-1111-1111-111111111111';
  const ticketCommentId = '33333333-3333-3333-3333-333333333333';
  const ticketArtifactIds = ['55555555-5555-4555-8555-555555555555'];

  it('delegates artifact reference replacement to the repository', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketCommentArtifactService(mockDBConnection);
    const replaceStub = sinon
      .stub(TicketCommentArtifactRepository.prototype, 'replaceTicketCommentArtifacts')
      .resolves();

    await service.replaceTicketCommentArtifacts(ticketId, ticketCommentId, ticketArtifactIds);

    expect(replaceStub).to.have.been.calledOnceWith(ticketId, ticketCommentId, ticketArtifactIds);
  });

  it('delegates artifact reference deletion to the repository', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketCommentArtifactService(mockDBConnection);
    const deleteStub = sinon.stub(TicketCommentArtifactRepository.prototype, 'deleteTicketCommentArtifacts').resolves();

    await service.deleteTicketCommentArtifacts(ticketCommentId);

    expect(deleteStub).to.have.been.calledOnceWith(ticketCommentId);
  });
});
