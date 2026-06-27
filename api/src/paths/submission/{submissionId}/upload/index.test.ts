import chai, { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSubmissionUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP401 } from '../../../../errors/http-error';
import { SystemUserExtended } from '../../../../repositories/user-repository';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { PresignedUploadUrlResponse } from '../../../../services/upload/upload-ingestion-service.interface';
import { UserService } from '../../../../services/user-service';

chai.use(sinonChai);

const mockUploadResponse: PresignedUploadUrlResponse = {
  submissionId: 'mock-submission-uuid',
  submissionUploadId: 'mock-submission-upload-id',
  uploadId: 'mock-upload-id',
  s3UploadId: 'mock-s3-upload-id',
  uploadArchiveId: 'mock-archive-id',
  key: 'mock-key',
  partCount: 1,
  presignedUrls: [{ partNumber: 1, url: 'https://example.com/part1', partSizeBytes: 12345 }]
};

// Token that resolves to a user guid + identifier via keycloak-utils.
const mockToken = { preferred_username: '42-guid@idir', idir_username: 'jsmith', identity_provider: 'idir' };
const submissionUuid = '11111111-1111-1111-1111-111111111111';

describe('append submission upload handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('when authenticated', () => {
    let ensureSystemUserStub: sinon.SinonStub;

    beforeEach(() => {
      ensureSystemUserStub = sinon
        .stub(UserService.prototype, 'ensureSystemUser')
        .resolves({ system_user_id: 42 } as SystemUserExtended);
    });

    it('should initialize the append upload and return 201, forwarding the submitter id', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const startAppendStub = sinon
        .stub(UploadIngestionService.prototype, 'startArchiveUploadForExistingSubmissionByUuid')
        .resolves(mockUploadResponse);

      const requestHandler = createSubmissionUpload();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: submissionUuid };
      mockReq.body = { bytes: 12345 };
      mockReq.keycloak_token = mockToken;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(ensureSystemUserStub).to.have.been.calledOnceWith('42-guid', 'jsmith', sinon.match.string);

      expect(startAppendStub).to.have.been.calledOnce;
      expect(startAppendStub.getCall(0).args[0]).to.equal(12345);
      expect(startAppendStub.getCall(0).args[1]).to.equal(submissionUuid);
      // Appending user (token user) forwarded for the submission_team grant.
      expect(startAppendStub.getCall(0).args[2]).to.equal(42);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.deep.equal(mockUploadResponse);
      expect(dbConnectionObj.commit).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    });

    it('should rollback and rethrow if the upload service fails', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const error = new Error('Append failed');
      sinon.stub(UploadIngestionService.prototype, 'startArchiveUploadForExistingSubmissionByUuid').rejects(error);

      const requestHandler = createSubmissionUpload();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { submissionId: submissionUuid };
      mockReq.body = { bytes: 12345 };
      mockReq.keycloak_token = mockToken;

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect(err).to.equal(error);
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;
      }
    });
  });

  it('should reject with 401 and not create records when the token cannot be resolved to a user', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const ensureSystemUserStub = sinon.stub(UserService.prototype, 'ensureSystemUser');
    const startAppendStub = sinon.stub(
      UploadIngestionService.prototype,
      'startArchiveUploadForExistingSubmissionByUuid'
    );

    const requestHandler = createSubmissionUpload();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { submissionId: submissionUuid };
    mockReq.body = { bytes: 12345 };
    // Token without preferred_username / idir_username cannot resolve to a user guid.
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).to.be.instanceOf(HTTP401);
      expect(ensureSystemUserStub).to.not.have.been.called;
      expect(startAppendStub).to.not.have.been.called;
      expect(dbConnectionObj.commit).to.not.have.been.called;
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});
