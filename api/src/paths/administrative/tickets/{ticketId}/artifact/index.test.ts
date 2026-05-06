import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { TicketArtifact } from '../../../../../models/ticket-artifact';
import { TicketArtifactService } from '../../../../../services/ticket-artifact-service';
import { getTicketArtifacts } from './index';

chai.use(sinonChai);

describe('paths/administrative/tickets/{ticketId}/artifact', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';
  const artifacts: TicketArtifact[] = [
    {
      ticket_artifact_id: '22222222-2222-4222-8222-222222222222',
      ticket_id: ticketId,
      artifact_id: '33333333-3333-4333-8333-333333333333',
      record_end_date: null,
      create_date: '2026-04-29T00:00:00.000Z',
      key: 'tickets/file.txt'
    }
  ];

  afterEach(() => {
    sinon.restore();
  });

  it('GET returns paginated ticket artifacts', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getArtifactsStub = sinon.stub(TicketArtifactService.prototype, 'getTicketArtifacts').resolves(artifacts);
    const getCountStub = sinon.stub(TicketArtifactService.prototype, 'getTicketArtifactsCount').resolves(1);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId };
    mockReq.query = { page: '2', limit: '10', sort: 'create_date', order: 'desc' };

    await getTicketArtifacts()(mockReq, mockRes, mockNext);

    expect(getArtifactsStub).to.have.been.calledOnceWith(ticketId, {
      page: 2,
      limit: 10,
      sort: 'create_date',
      order: 'desc'
    });
    expect(getCountStub).to.have.been.calledOnceWith(ticketId);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      artifacts,
      pagination: {
        total: 1,
        per_page: 10,
        current_page: 2,
        last_page: 1,
        sort: 'create_date',
        order: 'desc'
      }
    });
  });

  it('rolls back and rethrows errors', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const error = new Error('failed');
    sinon.stub(TicketArtifactService.prototype, 'getTicketArtifacts').rejects(error);
    sinon.stub(TicketArtifactService.prototype, 'getTicketArtifactsCount').resolves(0);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId };
    mockReq.query = {};

    try {
      await getTicketArtifacts()(mockReq, mockRes, mockNext);
      expect.fail('Expected error not thrown');
    } catch (caughtError) {
      expect(caughtError).to.equal(error);
      expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
    }
  });
});
