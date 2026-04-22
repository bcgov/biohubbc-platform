import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { startUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { PresignedUploadUrlResponse } from '../../../../services/upload/upload-ingestion-service.interface';

chai.use(sinonChai);

describe('archive upload handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should initialize upload and return 201 on success', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

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

    const startArchiveUploadStub = sinon
      .stub(UploadIngestionService.prototype, 'startArchiveUpload')
      .resolves(mockUploadResponse);

    const requestHandler = startUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      bytes: 12345,
      name: 'name',
      description: 'description',
      comment: 'comment'
    };
    mockReq.system_user = { system_user_id: 42 };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };
    mockReq.contributor_id = 11;

    await requestHandler(mockReq, mockRes, mockNext);

    expect(startArchiveUploadStub).to.have.been.calledOnce;
    expect(startArchiveUploadStub.getCall(0).args[0]).to.equal(12345);
    expect(startArchiveUploadStub.getCall(0).args[1]).to.include({
      name: 'name',
      description: 'description',
      comment: 'comment',
      system_user_id: 42,
      contributor_id: 11
    });

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

    mockReq.body = {
      bytes: 12345,
      name: 'name',
      description: 'description',
      comment: 'comment'
    };
    mockReq.system_user = { system_user_id: 42 };
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

  it('should generate a UUID for the submission object', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const startArchiveUploadStub = sinon.stub(UploadIngestionService.prototype, 'startArchiveUpload').resolves({
      submissionId: 'mock-submission-uuid',
      submissionUploadId: 'mock-submission-upload-id',
      uploadId: 'mock-upload-id',
      s3UploadId: 'mock-s3-upload-id',
      uploadArchiveId: 'mock-archive-id',
      key: 'mock-key',
      partCount: 1,
      presignedUrls: [{ partNumber: 1, url: 'https://example.com/part1', partSizeBytes: 12345 }]
    } as PresignedUploadUrlResponse);

    const requestHandler = startUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.body = {
      bytes: 12345,
      name: 'name',
      description: 'description',
      comment: 'comment'
    };
    mockReq.system_user = { system_user_id: 42 };
    mockReq.keycloak_token = { clientId: 'biohub-web' };
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
