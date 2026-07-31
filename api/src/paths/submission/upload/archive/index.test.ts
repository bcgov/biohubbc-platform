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
  submissionUuid: 'mock-submission-uuid',
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

const mockSubmitters = [
  { guid: '42-guid', identifier: 'jsmith', identitySource: 'IDIR' },
  { guid: '43-guid', identifier: 'adoe', identitySource: 'BCEIDBUSINESS' }
];
const contributorServiceSystemUserId = 7;

const mockBody = {
  bytes: 12345,
  name: 'name',
  description: 'description',
  comment: 'comment',
  submitters: mockSubmitters
};

describe('archive upload handler', () => {
  let ensureSystemUserStub: sinon.SinonStub;

  beforeEach(() => {
    ensureSystemUserStub = sinon
      .stub(UserService.prototype, 'ensureSystemUser')
      .callsFake(async (guid: string) => ({ system_user_id: guid === '42-guid' ? 42 : 43 } as SystemUserExtended));
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should resolve all body submitters, initialize the upload, and return 201 on success', async () => {
    const dbConnectionObj = getMockDBConnection({
      systemUserId: () => contributorServiceSystemUserId,
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

    expect(ensureSystemUserStub).to.have.been.calledTwice;
    expect(ensureSystemUserStub.firstCall).to.have.been.calledWith('42-guid', 'jsmith', 'IDIR');
    expect(ensureSystemUserStub.secondCall).to.have.been.calledWith('43-guid', 'adoe', 'BCEIDBUSINESS');

    expect(startArchiveUploadStub).to.have.been.calledOnce;
    expect(startArchiveUploadStub.getCall(0).args[0]).to.equal(12345);
    expect(startArchiveUploadStub.getCall(0).args[1]).to.include({
      name: 'name',
      description: 'description',
      comment: 'comment',
      system_user_id: contributorServiceSystemUserId,
      contributor_id: 11
    });
    expect(startArchiveUploadStub.getCall(0).args[2]).to.deep.equal([42, 43]);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.deep.equal(mockUploadResponse);

    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should initialize the upload without resolving an optional submitter', async () => {
    const dbConnectionObj = getMockDBConnection({
      systemUserId: () => contributorServiceSystemUserId,
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

    mockReq.body = {
      bytes: mockBody.bytes,
      name: mockBody.name,
      description: mockBody.description,
      comment: mockBody.comment
    };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

    await requestHandler(mockReq, mockRes, mockNext);

    expect(ensureSystemUserStub).not.to.have.been.called;
    expect(startArchiveUploadStub.getCall(0).args[1]).to.include({
      system_user_id: contributorServiceSystemUserId
    });
    expect(startArchiveUploadStub.getCall(0).args[2]).to.deep.equal([]);
    expect(mockRes.statusValue).to.equal(201);
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
  });

  it('should resolve duplicate submitter claims only once', async () => {
    const dbConnectionObj = getMockDBConnection({
      systemUserId: () => contributorServiceSystemUserId,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    const startArchiveUploadStub = sinon
      .stub(UploadIngestionService.prototype, 'startArchiveUpload')
      .resolves(mockUploadResponse);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = {
      ...mockBody,
      submitters: [mockSubmitters[0], { ...mockSubmitters[0], guid: '42-GUID', identitySource: 'BCEIDBUSINESS' }]
    };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

    await startUpload()(mockReq, mockRes, mockNext);

    expect(ensureSystemUserStub).to.have.been.calledOnce;
    expect(startArchiveUploadStub.getCall(0).args[2]).to.deep.equal([42]);
  });

  it('should rollback and throw error if upload service fails', async () => {
    const dbConnectionObj = getMockDBConnection({
      systemUserId: () => contributorServiceSystemUserId,
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
      systemUserId: () => contributorServiceSystemUserId,
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
      systemUserId: () => contributorServiceSystemUserId,
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
      system_user_id: contributorServiceSystemUserId,
      contributor_id: 11
    });
    expect(startArchiveUploadStub.getCall(0).args[2]).to.deep.equal([42, 43]);
  });
});
