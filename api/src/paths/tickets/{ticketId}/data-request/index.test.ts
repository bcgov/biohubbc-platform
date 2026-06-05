import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { DataRequest } from '../../../../models/data-request';
import { DataRequestService } from '../../../../services/data-request-service';
import { createTicketDataRequest } from './index';

chai.use(sinonChai);

describe('paths/tickets/{ticketId}/data-request', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('POST creates a ticket-owned data request', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

    const createdDataRequest: DataRequest = {
      data_request_id: '11111111-1111-1111-1111-111111111111',
      reason: 'Need secured data for investigation',
      team_id: '22222222-2222-2222-2222-222222222222',
      requested_by: 1,
      ticket_id: '33333333-3333-3333-3333-333333333333',
      policy_id: '44444444-4444-4444-4444-444444444444',
      status: 'requested',
      create_date: '2026-04-17T00:00:00.000Z'
    };

    const createStub = sinon
      .stub(DataRequestService.prototype, 'createDataRequestForTicket')
      .resolves(createdDataRequest);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: createdDataRequest.ticket_id };
    mockReq.body = {
      requested_by: createdDataRequest.requested_by,
      reason: createdDataRequest.reason,
      system_user_ids: [2, 3]
    };

    await createTicketDataRequest()(mockReq, mockRes, mockNext);

    expect(createStub).to.have.been.calledOnceWith(createdDataRequest.ticket_id, {
      requested_by: createdDataRequest.requested_by,
      reason: createdDataRequest.reason,
      system_user_ids: [2, 3]
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(createdDataRequest);
  });
});
