import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../../database/db';
import { TicketReference } from '../../../../../models/ticket-reference';
import { TicketService } from '../../../../../services/ticket-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { createTicketReference } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/reference', () => {
  const sourceTicketId = '11111111-1111-1111-1111-111111111111';
  const targetTicketId = '22222222-2222-2222-2222-222222222222';

  afterEach(() => {
    sinon.restore();
  });

  it('POST creates ticket references', async () => {
    const createdReferences: TicketReference[] = [
      {
        ticket_reference_id: '33333333-3333-3333-3333-333333333333',
        source_ticket_id: sourceTicketId,
        source_ticket_slug: '04900001',
        source_ticket_subject: 'Source ticket',
        target_ticket_id: targetTicketId,
        target_ticket_slug: '04900002',
        target_ticket_subject: 'Target ticket',
        relationship: 'relates_to',
        user_identifier: 'Sarah',
        create_date: '2026-02-25T00:00:00.000Z'
      }
    ];

    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    const createReferenceStub = sinon
      .stub(TicketService.prototype, 'createTicketReference')
      .resolves(createdReferences);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: sourceTicketId };
    mockReq.body = { references: [{ target_ticket_id: targetTicketId, relationship: 'relates_to' }] };

    await createTicketReference()(mockReq, mockRes, mockNext);

    expect(createReferenceStub).to.have.been.calledWith(sourceTicketId, {
      references: [{ target_ticket_id: targetTicketId, relationship: 'relates_to' }]
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(createdReferences);
  });
});
