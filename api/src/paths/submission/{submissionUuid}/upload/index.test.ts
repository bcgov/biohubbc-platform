import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSubmissionUpload, GET, listSubmissionUploads, POST } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getOperationHandler } from '../../../../__mocks__/operation';
import * as db from '../../../../database/db';
import { HTTP403 } from '../../../../errors/http-error';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../services/upload/submission-upload-service';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { PresignedUploadUrlResponse } from '../../../../services/upload/upload-ingestion-service.interface';

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
  afterEach(() => {
    sinon.restore();
  });

  it('authorizes the submission team before processing the upload', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid };

    await getOperationHandler(POST, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ discriminator: 'Team', entity: 'submission', submissionUuid }]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('rejects unauthorized users before processing the upload', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    try {
      await getOperationHandler(POST, 0)(mockReq, mockRes, mockNext);
      expect.fail('Expected authorization failure');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }
    expect(mockNext).not.to.have.been.called;
  });

  it('passes explicit contributor selection, submitters and Blueprint selection to the upload service', async () => {
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
    mockReq.body = { bytes: 12345, archiveFormat: 'tar.gz', submitters: mockSubmitters, blueprint_id: 7 };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(startAppendStub).to.have.been.calledOnceWith({
      bytes: 12345,
      archiveFormat: mockReq.body.archiveFormat,
      submissionUuid,
      submitters: mockSubmitters,
      blueprintId: 7
    });

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

    expect(startAppendStub).to.have.been.calledOnceWith({
      bytes: 12345,
      archiveFormat: mockReq.body.archiveFormat,
      submissionUuid,
      submitters: [],
      blueprintId: undefined
    });
    expect(mockRes.statusValue).to.equal(201);
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
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
    mockReq.body = { bytes: 12345, archiveFormat: 'tar.gz', submitters: mockSubmitters, blueprint_id: 7 };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail('Expected error to be thrown');
    } catch (err) {
      expect(err).to.equal(error);
      expect(dbConnectionObj.commit).not.to.have.been.called;
      expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    }
  });
});

describe('list submission uploads handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('authorizes the submission team before listing uploads', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid };

    await getOperationHandler(GET, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ discriminator: 'Team', entity: 'submission', submissionUuid }]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('rejects users outside the submission team before listing uploads', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const listStub = sinon.stub(SubmissionUploadService.prototype, 'listSubmissionUploadsBySubmissionUuid');
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid };

    try {
      await getOperationHandler(GET, 0)(mockReq, mockRes, mockNext);
      expect.fail('Expected authorization failure');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }

    expect(listStub).not.to.have.been.called;
  });

  it("returns a page of the submission's uploads", async () => {
    const dbConnectionObj = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    const page = { uploads: [], pagination: { total: 0, current_page: 2, last_page: 1, per_page: 10 } };
    const listStub = sinon
      .stub(SubmissionUploadService.prototype, 'listSubmissionUploadsBySubmissionUuid')
      .resolves(page as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionUuid };
    mockReq.query = { page: '2', limit: '10', sort: 'create_date', order: 'desc' };

    await listSubmissionUploads()(mockReq, mockRes, mockNext);

    expect(listStub).to.have.been.calledOnceWith(submissionUuid, sinon.match({ page: 2, limit: 10 }));
    expect(dbConnectionObj.commit).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.equal(page);
  });

  it('rolls back and rethrows when listing fails', async () => {
    const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
    const error = new Error('list failed');
    sinon.stub(SubmissionUploadService.prototype, 'listSubmissionUploadsBySubmissionUuid').rejects(error);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionUuid };

    try {
      await listSubmissionUploads()(mockReq, mockRes, mockNext);
      expect.fail('Expected listing failure');
    } catch (error_) {
      expect(error_).to.equal(error);
    }

    expect(dbConnectionObj.rollback).to.have.been.calledOnce;
    expect(dbConnectionObj.release).to.have.been.calledOnce;
  });
});
