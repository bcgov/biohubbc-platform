import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { TicketSystemUser } from '../../../../models/ticket-system-user';
import { TicketSystemUserService } from '../../../../services/ticket-system-user-service';
import { createTicketSystemUser } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}/system-user', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('POST creates ticket assignees in bulk', async () => {
    const mockDBConnection = getMockDBConnection({
      systemUserId: () => 1,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const created: TicketSystemUser = {
      ticket_system_user_id: '22222222-2222-2222-2222-222222222222',
      ticket_id: '11111111-1111-1111-1111-111111111111',
      system_user_id: 2,
      status: 'requested'
    };

    const createStub = sinon.stub(TicketSystemUserService.prototype, 'createTicketAssignees').resolves([created]);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: created.ticket_id };
    mockReq.body = [{ system_user_id: created.system_user_id, status: created.status }];
    mockReq.system_user = { system_user_id: 1, role_names: ['System Administrator'] } as never;

    await createTicketSystemUser()(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledWith(created.ticket_id, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql([created]);
  });
});
