import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSubmissionUpload, POST } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { SystemUserExtended } from '../../../../repositories/user-repository';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { PresignedUploadUrlResponse } from '../../../../services/upload/upload-ingestion-service.interface';
import { UserService } from '../../../../services/user-service';

chai.use(sinonChai);

const mockUploadResponse: PresignedUploadUrlResponse = {
  submissionUuid: 'mock-submission-uuid',
  submissionUploadId: 'mock-submission-upload-id',
  uploadId: 'mock-upload-id',
  s3UploadId: 'mock-s3-upload-id',
  uploadArchiveId: 'mock-archive-id',
  key: 'mock-key',
  partCount: 1,
  presignedUrls: [{ partNumber: 1, url: 'https://example.com/part1', partSizeBytes: 12345 }]
};

const mockSubmitters = [
  { guid: '42-guid', identifier: 'jsmith', identitySource: 'IDIR' },
  { guid: '43-guid', identifier: 'adoe', identitySource: 'BCEIDBUSINESS' }
];
const submissionUuid = '11111111-1111-1111-1111-111111111111';

describe('append submission upload handler', () => {
  let ensureSystemUserStub: sinon.SinonStub;

  beforeEach(() => {
    ensureSystemUserStub = sinon
      .stub(UserService.prototype, 'ensureSystemUser')
      .callsFake(async (guid: string) => ({ system_user_id: guid === '42-guid' ? 42 : 43 } as SystemUserExtended));
  });

  afterEach(() => {
    sinon.restore();
  });

  it('authorizes submission-team members and system administrators before handling the request', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { submissionUuid };

    await (POST[0] as RequestHandler)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      or: [
        { discriminator: 'Team', entity: 'submission', submissionUuid },
        { validSystemRoles: ['System Administrator'], discriminator: 'SystemRole' }
      ]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('should resolve all body submitters, initialize the append upload, and forward their ids', async () => {
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

    mockReq.params = { submissionUuid };
    mockReq.body = { bytes: 12345, submitters: mockSubmitters };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(ensureSystemUserStub).to.have.been.calledTwice;
    expect(ensureSystemUserStub.firstCall).to.have.been.calledWith('42-guid', 'jsmith', 'IDIR');
    expect(ensureSystemUserStub.secondCall).to.have.been.calledWith('43-guid', 'adoe', 'BCEIDBUSINESS');

    expect(startAppendStub).to.have.been.calledOnce;
    expect(startAppendStub.getCall(0).args[0]).to.equal(12345);
    expect(startAppendStub.getCall(0).args[1]).to.equal(submissionUuid);
    expect(startAppendStub.getCall(0).args[2]).to.deep.equal([42, 43]);

    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.deep.equal(mockUploadResponse);
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should initialize the append upload when submitters is empty', async () => {
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

    mockReq.params = { submissionUuid };
    mockReq.body = { bytes: 12345, submitters: [] };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(ensureSystemUserStub).not.to.have.been.called;
    expect(startAppendStub).to.have.been.calledOnceWith(12345, submissionUuid, [], undefined);
    expect(mockRes.statusValue).to.equal(201);
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
  });

  it('should resolve duplicate submitter claims only once', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    const startAppendStub = sinon
      .stub(UploadIngestionService.prototype, 'startArchiveUploadForExistingSubmissionByUuid')
      .resolves(mockUploadResponse);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid };
    mockReq.body = {
      bytes: 12345,
      submitters: [mockSubmitters[0], { ...mockSubmitters[0], guid: '42-GUID', identitySource: 'BCEIDBUSINESS' }]
    };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    await createSubmissionUpload()(mockReq, mockRes, mockNext);

    expect(ensureSystemUserStub).to.have.been.calledOnce;
    expect(startAppendStub).to.have.been.calledOnceWith(12345, submissionUuid, [42], undefined);
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

    mockReq.params = { submissionUuid };
    mockReq.body = { bytes: 12345, submitters: mockSubmitters };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).to.equal(error);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should rollback and create no records when the submitter cannot be resolved', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    ensureSystemUserStub.rejects(new Error('Failed to resolve submitter'));
    const startAppendStub = sinon.stub(
      UploadIngestionService.prototype,
      'startArchiveUploadForExistingSubmissionByUuid'
    );

    const requestHandler = createSubmissionUpload();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = { submissionUuid };
    mockReq.body = { bytes: 12345, submitters: mockSubmitters };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch {
      expect(startAppendStub).to.not.have.been.called;
      expect(dbConnectionObj.commit).to.not.have.been.called;
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});
