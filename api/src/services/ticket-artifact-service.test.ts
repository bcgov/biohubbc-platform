import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { TicketArtifact } from '../models/ticket-artifact';
import { TicketArtifactRepository } from '../repositories/ticket-artifact-repository';
import { TicketArtifactService } from './ticket-artifact-service';

chai.use(sinonChai);

describe('TicketArtifactService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const ticketId = '11111111-1111-1111-1111-111111111111';
  const artifactIds: string[] = ['22222222-2222-2222-2222-222222222222'];
  const artifacts: TicketArtifact[] = [
    {
      ticket_artifact_id: '33333333-3333-3333-8333-333333333333',
      ticket_id: ticketId,
      artifact_id: artifactIds[0],
      record_end_date: null,
      create_date: '2026-04-29T00:00:00.000Z',
      key: 'tickets/abc/file.txt'
    }
  ];

  it('delegates inserting ticket artifacts to the repository', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketArtifactService(mockDBConnection);
    const insertStub = sinon.stub(TicketArtifactRepository.prototype, 'insertTicketArtifacts').resolves(artifacts);

    const result = await service.insertTicketArtifacts(ticketId, artifactIds);

    expect(insertStub).to.have.been.calledOnceWith(ticketId, artifactIds);
    expect(result).to.eql(artifacts);
  });

  it('delegates ticket artifact lookup to the repository', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketArtifactService(mockDBConnection);
    const getStub = sinon.stub(TicketArtifactRepository.prototype, 'getTicketArtifacts').resolves(artifacts);

    const result = await service.getTicketArtifacts(ticketId);

    expect(getStub).to.have.been.calledOnceWith(ticketId);
    expect(result).to.eql(artifacts);
  });

  it('passes optional pagination through ticket artifact lookup', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketArtifactService(mockDBConnection);
    const pagination = { page: 1, limit: 10, sort: 'create_date', order: 'desc' as const };
    const getStub = sinon.stub(TicketArtifactRepository.prototype, 'getTicketArtifacts').resolves(artifacts);

    const result = await service.getTicketArtifacts(ticketId, pagination);

    expect(getStub).to.have.been.calledOnceWith(ticketId, pagination);
    expect(result).to.eql(artifacts);
  });

  it('delegates ticket artifact count to the repository', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketArtifactService(mockDBConnection);
    const getStub = sinon.stub(TicketArtifactRepository.prototype, 'getTicketArtifactsCount').resolves(1);

    const result = await service.getTicketArtifactsCount(ticketId);

    expect(getStub).to.have.been.calledOnceWith(ticketId);
    expect(result).to.equal(1);
  });

  it('delegates single ticket artifact lookup to the repository', async () => {
    const mockDBConnection = getMockDBConnection();
    const service = new TicketArtifactService(mockDBConnection);
    const getStub = sinon.stub(TicketArtifactRepository.prototype, 'findTicketArtifactById').resolves(artifacts[0]);

    const result = await service.findTicketArtifactById(ticketId, artifacts[0].ticket_artifact_id);

    expect(getStub).to.have.been.calledOnceWith(ticketId, artifacts[0].ticket_artifact_id);
    expect(result).to.eql(artifacts[0]);
  });
});
