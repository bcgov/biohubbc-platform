import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { TicketSystemUser } from '../../../../../models/ticket-system-user';
import { TicketSystemUserService } from '../../../../../services/ticket-system-user-service';
import { deleteTicketSystemUser, patchTicketSystemUser } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}/system-user/{ticketSystemUserId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH updates ticket assignee status', async () => {
    const mockDBConnection = getMockDBConnection({
      systemUserId: () => 7,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const updated: TicketSystemUser = {
      ticket_system_user_id: '22222222-2222-2222-2222-222222222222',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      system_user_id: 7,
      status: 'started'
    };

    const patchStub = sinon.stub(TicketSystemUserService.prototype, 'updateTicketAssigneeStatus').resolves(updated);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: updated.ticket_id, ticketSystemUserId: updated.ticket_system_user_id };
    mockReq.body = { status: 'started' };
    mockReq.system_user = { system_user_id: 7, role_names: ['Member'] } as never;

    await patchTicketSystemUser()(mockReq, mockRes, mockNext);

    expect(patchStub).to.have.been.calledWith(updated.ticket_id, updated.ticket_system_user_id, { status: 'started' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(updated);
  });

  it('DELETE soft deletes ticket assignee', async () => {
    const mockDBConnection = getMockDBConnection({
      systemUserId: () => 1,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const deleteStub = sinon.stub(TicketSystemUserService.prototype, 'deleteTicketAssignee').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      ticketId: '11111111-1111-1111-1111-111111111111',
      ticketSystemUserId: '22222222-2222-2222-2222-222222222222'
    };
    mockReq.system_user = { system_user_id: 1, role_names: ['System Administrator'] } as never;

    await deleteTicketSystemUser()(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledWith(mockReq.params.ticketId, mockReq.params.ticketSystemUserId);
    expect(mockRes.statusValue).to.equal(204);
  });
});
