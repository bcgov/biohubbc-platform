import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { TicketArtifact } from '../../../../../../models/ticket-artifact';
import { TicketUploadService } from '../../../../../../services/ticket-upload-service';
import { completeTicketUpload } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/upload/{uploadId}', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';
  const uploadId = '22222222-2222-2222-2222-222222222222';

  afterEach(() => {
    sinon.restore();
  });

  it('PUT completes ticket upload asynchronously', async () => {
    const ticketArtifact: TicketArtifact = {
      ticket_artifact_id: '33333333-3333-4333-8333-333333333333',
      ticket_id: ticketId,
      artifact_id: '44444444-4444-4444-8444-444444444444',
      record_end_date: null,
      create_date: '2026-04-29T00:00:00.000Z',
      key: 'tickets/file.txt'
    };
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const completeStub = sinon.stub(TicketUploadService.prototype, 'completeTicketUpload').resolves(ticketArtifact);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, uploadId };
    mockReq.body = { status: 'uploaded' };

    await completeTicketUpload()(mockReq, mockRes, mockNext);

    expect(completeStub).to.have.been.calledOnceWith(ticketId, uploadId, { status: 'uploaded' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(ticketArtifact);
  });
});
