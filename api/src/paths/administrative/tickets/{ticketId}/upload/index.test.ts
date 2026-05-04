import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { CreateTicketUploadResponse } from '../../../../../models/ticket-upload';
import { TicketUploadService } from '../../../../../services/ticket-upload-service';
import { createTicketUpload } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/upload', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';

  afterEach(() => {
    sinon.restore();
  });

  it('POST initializes ticket upload', async () => {
    const response: CreateTicketUploadResponse = {
      upload_id: '22222222-2222-2222-2222-222222222222',
      presigned_upload_url: 'https://example.com/presigned'
    };

    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const initializeStub = sinon.stub(TicketUploadService.prototype, 'initializeTicketUpload').resolves(response);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId };
    mockReq.body = {
      file_name: 'example.txt',
      byte_size: 10,
      content_type: 'text/plain'
    };

    await createTicketUpload()(mockReq, mockRes, mockNext);

    expect(initializeStub).to.have.been.calledOnceWith(ticketId, {
      file_name: 'example.txt',
      byte_size: 10,
      content_type: 'text/plain'
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(response);
  });
});
