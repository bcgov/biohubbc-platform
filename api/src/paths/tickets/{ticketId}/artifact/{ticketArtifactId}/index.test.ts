import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import * as db from '../../../../../database/db';
import { HTTP401 } from '../../../../../errors/http-error';
import { Artifact, ArtifactStatusEnum } from '../../../../../models/artifact';
import { ArtifactSecurity } from '../../../../../models/artifact-security';
import { SecurityStatusEnum } from '../../../../../models/security-status';
import { TicketArtifact } from '../../../../../models/ticket-artifact';
import { TicketArtifactService } from '../../../../../services/ticket-artifact-service';
import { ArtifactSecurityService } from '../../../../../services/upload/artifact-security-service';
import { ArtifactService } from '../../../../../services/upload/artifact-service';
import { getArtifactDownloadUrl } from './index';

interface ArtifactDownloadResponse {
  signed_url: string;
}

chai.use(sinonChai);

describe('paths/tickets/{ticketId}/artifact/{ticketArtifactId}', () => {
  const ticketId = '11111111-1111-1111-1111-111111111111';
  const ticketArtifactId = '22222222-2222-4222-9222-222222222222';
  const artifactId = '33333333-3333-4333-9333-333333333333';
  const ticketArtifact: TicketArtifact = {
    ticket_artifact_id: ticketArtifactId,
    ticket_id: ticketId,
    artifact_id: artifactId,
    record_end_date: null,
    create_date: '2026-04-29T00:00:00.000Z',
    key: 'tickets/file.txt'
  };
  const artifact: Artifact = {
    artifact_id: artifactId,
    artifact_status: ArtifactStatusEnum.UPLOADED,
    bucket: 'main-bucket',
    object_key: 'tickets/file.txt',
    byte_size: '123',
    checksum_sha256: null,
    uploaded_at: '2026-04-29T00:00:00.000Z',
    format: 'txt'
  };
  const cleanSecurity: ArtifactSecurity = {
    artifact_security_id: '44444444-4444-4444-8444-444444444444',
    artifact_id: artifactId,
    security: SecurityStatusEnum.CLEAN
  };

  beforeEach(() => {
    process.env.OBJECT_STORE_BUCKET_NAME = 'main-bucket';
    process.env.QUARANTINE_OBJECT_STORE_BUCKET_NAME = 'quarantine-bucket';
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns a presigned ticket attachment download URL', async () => {
    const response: ArtifactDownloadResponse = { signed_url: 'https://example.com/download' };
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const getTicketArtifactStub = sinon
      .stub(TicketArtifactService.prototype, 'findTicketArtifactById')
      .resolves(ticketArtifact);
    const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(artifact);
    const getLatestSecurityStub = sinon
      .stub(ArtifactSecurityService.prototype, 'findLatestArtifactSecurityByArtifactId')
      .resolves(cleanSecurity);
    const getDownloadUrlStub = sinon
      .stub(ArtifactService.prototype, 'getArtifactSignedUrl')
      .resolves(response.signed_url);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketArtifactId };

    await getArtifactDownloadUrl()(mockReq, mockRes, mockNext);

    expect(getTicketArtifactStub).to.have.been.calledOnceWith(ticketId, ticketArtifactId);
    expect(getArtifactStub).to.have.been.calledOnceWith(artifactId);
    expect(getLatestSecurityStub).to.have.been.calledOnceWith(artifactId);
    expect(getDownloadUrlStub).to.have.been.calledOnceWith(artifactId);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(response);
  });

  it('rejects ticket artifacts that are not linked to the ticket', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TicketArtifactService.prototype, 'findTicketArtifactById').resolves(null);
    const getArtifactStub = sinon.stub(ArtifactService.prototype, 'getArtifact');
    const getLatestSecurityStub = sinon.stub(
      ArtifactSecurityService.prototype,
      'findLatestArtifactSecurityByArtifactId'
    );
    const getDownloadUrlStub = sinon.stub(ArtifactService.prototype, 'getArtifactSignedUrl');

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketArtifactId };

    try {
      await getArtifactDownloadUrl()(mockReq, mockRes, mockNext);
      expect.fail('Expected error not thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP401);
      expect(getArtifactStub).not.to.have.been.called;
      expect(getLatestSecurityStub).not.to.have.been.called;
      expect(getDownloadUrlStub).not.to.have.been.called;
      expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
    }
  });

  for (const security of [SecurityStatusEnum.PENDING, SecurityStatusEnum.INFECTED, SecurityStatusEnum.ERROR]) {
    it(`rejects ticket artifacts with ${security} security`, async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(TicketArtifactService.prototype, 'findTicketArtifactById').resolves(ticketArtifact);
      sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(artifact);
      sinon
        .stub(ArtifactSecurityService.prototype, 'findLatestArtifactSecurityByArtifactId')
        .resolves({ ...cleanSecurity, security });
      const getDownloadUrlStub = sinon.stub(ArtifactService.prototype, 'getArtifactSignedUrl');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { ticketId, ticketArtifactId };

      try {
        await getArtifactDownloadUrl()(mockReq, mockRes, mockNext);
        expect.fail('Expected error not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP401);
        expect(getDownloadUrlStub).not.to.have.been.called;
        expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
      }
    });
  }

  it('rejects ticket artifacts with no security row', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TicketArtifactService.prototype, 'findTicketArtifactById').resolves(ticketArtifact);
    sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(artifact);
    sinon.stub(ArtifactSecurityService.prototype, 'findLatestArtifactSecurityByArtifactId').resolves(null);
    const getDownloadUrlStub = sinon.stub(ArtifactService.prototype, 'getArtifactSignedUrl');

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketArtifactId };

    try {
      await getArtifactDownloadUrl()(mockReq, mockRes, mockNext);
      expect.fail('Expected error not thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP401);
      expect(getDownloadUrlStub).not.to.have.been.called;
      expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
    }
  });

  it('rejects clean ticket artifacts still in quarantine', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(TicketArtifactService.prototype, 'findTicketArtifactById').resolves(ticketArtifact);
    sinon.stub(ArtifactService.prototype, 'getArtifact').resolves({ ...artifact, bucket: 'quarantine-bucket' });
    sinon.stub(ArtifactSecurityService.prototype, 'findLatestArtifactSecurityByArtifactId').resolves(cleanSecurity);
    const getDownloadUrlStub = sinon.stub(ArtifactService.prototype, 'getArtifactSignedUrl');

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketArtifactId };

    try {
      await getArtifactDownloadUrl()(mockReq, mockRes, mockNext);
      expect.fail('Expected error not thrown');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP401);
      expect(getDownloadUrlStub).not.to.have.been.called;
      expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
    }
  });

  it('rolls back and rethrows on error', async () => {
    const mockDBConnection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const fetchError = new Error('download failed');
    sinon.stub(TicketArtifactService.prototype, 'findTicketArtifactById').resolves(ticketArtifact);
    sinon.stub(ArtifactService.prototype, 'getArtifact').resolves(artifact);
    sinon.stub(ArtifactSecurityService.prototype, 'findLatestArtifactSecurityByArtifactId').resolves(cleanSecurity);
    sinon.stub(ArtifactService.prototype, 'getArtifactSignedUrl').rejects(fetchError);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId, ticketArtifactId };

    try {
      await getArtifactDownloadUrl()(mockReq, mockRes, mockNext);
      expect.fail('Expected error not thrown');
    } catch (error) {
      expect(error).to.equal(fetchError);
      expect((mockDBConnection.rollback as sinon.SinonStub).calledOnce).to.be.true;
    }
  });
});
