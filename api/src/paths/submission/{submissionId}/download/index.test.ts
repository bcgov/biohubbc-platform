import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSubmissionDownload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { ApiNotFoundError } from '../../../../errors/api-error';
import { DownloadService } from '../../../../services/download/download-service';
import { UserService } from '../../../../services/user-service';

chai.use(sinonChai);

describe('paths/submission/{submissionId}/download', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createSubmissionDownload', () => {
    it('creates a download of the submission for the authenticated user and returns 201', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(UserService.prototype, 'getUserById').resolves({} as any);
      const apiUserStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');
      const createStub = sinon
        .stub(DownloadService.prototype, 'createSubmissionDownloadRequest')
        .resolves({ download_id: 'download-uuid-auth' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { submissionId: '14' };

      await createSubmissionDownload()(mockReq, mockRes, mockNext);

      // Authenticated requests run on the user's connection, never the shared API-user one.
      expect(apiUserStub).to.not.have.been.called;
      expect(createStub).to.have.been.calledOnceWithExactly({ submissionId: 14, requestedBy: 42 });
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.have.property('download_id', 'download-uuid-auth');
      expect(mockRes.jsonValue.download_url).to.match(/\/api\/download\/download-uuid-auth$/);
    });

    it('runs anonymously with requestedBy null', async () => {
      const dbConnectionObj = getMockDBConnection();
      const apiUserStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const dbConnStub = sinon.stub(db.dbDependencies, 'getDBConnection');
      const createStub = sinon
        .stub(DownloadService.prototype, 'createSubmissionDownloadRequest')
        .resolves({ download_id: 'download-uuid-anon' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = undefined as any;
      mockReq.params = { submissionId: '14' };

      await createSubmissionDownload()(mockReq, mockRes, mockNext);

      // Anonymous requests run on the shared API-user connection, so the export holds only unsecured features.
      expect(apiUserStub).to.have.been.calledOnce;
      expect(dbConnStub).to.not.have.been.called;
      expect(createStub).to.have.been.calledOnceWithExactly({ submissionId: 14, requestedBy: null });
      expect(mockRes.statusValue).to.equal(201);
    });

    it('rolls back, releases, and propagates when the service throws', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 20,
        rollback: rollbackStub,
        release: releaseStub
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(UserService.prototype, 'getUserById').resolves({} as any);
      const serviceError = new ApiNotFoundError('Submission not found');
      sinon.stub(DownloadService.prototype, 'createSubmissionDownloadRequest').rejects(serviceError);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.params = { submissionId: '14' };

      try {
        await createSubmissionDownload()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.equal(serviceError);
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
      }
    });
  });
});
