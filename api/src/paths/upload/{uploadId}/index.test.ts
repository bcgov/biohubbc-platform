import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { completeUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { UploadIngestionService } from '../../../services/upload/upload-ingestion-service';

chai.use(sinonChai);

describe('completeUpload handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should complete the upload and return 201 on success', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const completeArchiveUploadStub = sinon.stub(UploadIngestionService.prototype, 'completeArchiveUpload').resolves();

    const requestHandler = completeUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      uploadId: 'mock-upload-id',
      uploadArchiveId: 'mock-archive-id'
    };
    mockReq.body = {
      s3UploadId: 'mock-s3-upload-id',
      key: 'mock-key',
      parts: [
        { PartNumber: 1, ETag: 'etag1' },
        { PartNumber: 2, ETag: 'etag2' }
      ]
    };
    mockReq.keycloak_token = 'mock-token';

    await requestHandler(mockReq, mockRes, mockNext);

    expect(completeArchiveUploadStub).to.have.been.calledOnceWith({
      uploadId: 'mock-upload-id',
      s3UploadId: 'mock-s3-upload-id',
      key: 'mock-key',
      parts: [
        { PartNumber: 1, ETag: 'etag1' },
        { PartNumber: 2, ETag: 'etag2' }
      ]
    });

    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.be.undefined;

    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });

  it('should rollback and throw error if completeArchiveUpload fails', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const error = new Error('Upload completion failed');
    sinon.stub(UploadIngestionService.prototype, 'completeArchiveUpload').rejects(error);

    const requestHandler = completeUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      uploadId: 'mock-upload-id',
      uploadArchiveId: 'mock-archive-id'
    };
    mockReq.body = {
      s3UploadId: 'mock-s3-upload-id',
      key: 'mock-key',
      parts: [{ PartNumber: 1, ETag: 'etag1' }]
    };
    mockReq.keycloak_token = 'mock-token';

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).to.equal(error);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should throw error if uploadId is missing in params', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const requestHandler = completeUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {}; // Missing uploadId
    mockReq.body = {
      s3UploadId: 'mock-s3-upload-id',
      key: 'mock-key',
      parts: [{ PartNumber: 1, ETag: 'etag1' }]
    };
    mockReq.keycloak_token = 'mock-token';

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error due to missing uploadId');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });

  it('should handle empty parts array gracefully', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const completeArchiveUploadStub = sinon.stub(UploadIngestionService.prototype, 'completeArchiveUpload').resolves();

    const requestHandler = completeUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      uploadId: 'mock-upload-id',
      uploadArchiveId: 'mock-archive-id'
    };
    mockReq.body = {
      s3UploadId: 'mock-s3-upload-id',
      key: 'mock-key',
      parts: [] // empty array
    };
    mockReq.keycloak_token = 'mock-token';

    await requestHandler(mockReq, mockRes, mockNext);

    expect(completeArchiveUploadStub).to.have.been.calledOnceWith({
      uploadId: 'mock-upload-id',
      s3UploadId: 'mock-s3-upload-id',
      key: 'mock-key',
      parts: []
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.be.undefined;
  });
});
