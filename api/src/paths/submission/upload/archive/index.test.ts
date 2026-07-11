import chai, { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { startUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
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
  partCount: 2,
  presignedUrls: [
    { partNumber: 1, url: 'https://example.com/part1', partSizeBytes: 5242880 },
    { partNumber: 2, url: 'https://example.com/part2', partSizeBytes: 1234 }
  ]
};

// The human submitter is supplied in the request body (the request itself is authenticated as the
// SIMS service client).
const mockSubmitter = { guid: '42-guid', identifier: 'jsmith', identitySource: 'IDIR' };

const mockBody = {
  bytes: 12345,
  name: 'name',
  description: 'description',
  comment: 'comment',
  submitter: mockSubmitter
};

describe('archive upload handler', () => {
  let ensureSystemUserStub: sinon.SinonStub;

  beforeEach(() => {
    ensureSystemUserStub = sinon
      .stub(UserService.prototype, 'ensureSystemUser')
      .resolves({ system_user_id: 42 } as SystemUserExtended);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should resolve the body submitter, initialize the upload, and return 201 on success', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const startArchiveUploadStub = sinon
      .stub(UploadIngestionService.prototype, 'startArchiveUpload')
      .resolves(mockUploadResponse);

    const requestHandler = startUpload();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = { ...mockBody };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

    await requestHandler(mockReq, mockRes, mockNext);

    // Submitter resolved from the request body, not the token.
    expect(ensureSystemUserStub).to.have.been.calledOnceWith('42-guid', 'jsmith', 'IDIR');

    expect(startArchiveUploadStub).to.have.been.calledOnce;
    expect(startArchiveUploadStub.getCall(0).args[0]).to.equal(12345);
    expect(startArchiveUploadStub.getCall(0).args[1]).to.include({
      name: 'name',
      description: 'description',
      comment: 'comment',
      system_user_id: 42,
      contributor_id: 11
    });
    // The submitter (not the service client) is forwarded for the submission_team grant.
    expect(startArchiveUploadStub.getCall(0).args[2]).to.equal(42);

    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.deep.equal(mockUploadResponse);

    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should rollback and throw error if upload service fails', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const error = new Error('Upload failed');
    sinon.stub(UploadIngestionService.prototype, 'startArchiveUpload').rejects(error);

    const requestHandler = startUpload();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = { ...mockBody };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

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

    // ensureSystemUser rejects (e.g. invalid identity source) -> nothing should be created.
    ensureSystemUserStub.rejects(new Error('Failed to resolve submitter'));
    const startArchiveUploadStub = sinon.stub(UploadIngestionService.prototype, 'startArchiveUpload');

    const requestHandler = startUpload();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = { ...mockBody };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch {
      expect(startArchiveUploadStub).to.not.have.been.called;
      expect(dbConnectionObj.commit).to.not.have.been.called;
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should generate a UUID for the submission object', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const startArchiveUploadStub = sinon
      .stub(UploadIngestionService.prototype, 'startArchiveUpload')
      .resolves(mockUploadResponse);

    const requestHandler = startUpload();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = { ...mockBody };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

    await requestHandler(mockReq, mockRes, mockNext);

    const submissionArg = startArchiveUploadStub.getCall(0).args[1];
    expect(submissionArg.uuid).to.be.a('string');
    expect(submissionArg).to.include({
      name: 'name',
      description: 'description',
      comment: 'comment',
      system_user_id: 42,
      contributor_id: 11
    });
  });
});
