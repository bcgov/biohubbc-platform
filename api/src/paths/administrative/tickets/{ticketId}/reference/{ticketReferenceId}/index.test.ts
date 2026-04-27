import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { TicketService } from '../../../../../../services/ticket-service';
import { deleteTicketReference } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/reference/{ticketReferenceId}', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';
  const ticketReferenceId = '33333333-3333-3333-3333-333333333333';

  afterEach(() => {
    sinon.restore();
  });

  it('DELETE removes a ticket reference', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const deleteReferenceStub = sinon.stub(TicketService.prototype, 'deleteTicketReference').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketReferenceId };

    await deleteTicketReference()(mockReq, mockRes, mockNext);

    expect(deleteReferenceStub).to.have.been.calledWith(ticketId, ticketReferenceId);
    expect(mockRes.statusValue).to.equal(204);
  });
});
