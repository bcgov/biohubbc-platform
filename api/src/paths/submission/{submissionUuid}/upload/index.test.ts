import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSubmissionUpload, POST } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP403 } from '../../../../errors/http-error';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
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

  for (const selection of [
    { clientId: 'selected-client', token: { clientId: 'token-client' }, expected: 'selected-client' },
    { clientId: undefined, token: { clientId: 'token-client' }, expected: 'token-client' },
    { clientId: undefined, token: { azp: 'token-client' }, expected: 'token-client' }
  ]) {
    it(`combines team authorization with effective client ID ${selection.expected}`, async () => {
      sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { submissionUuid };
      mockReq.body = { client_id: selection.clientId };
      mockReq.keycloak_token = selection.token;

      await (POST[0] as RequestHandler)(mockReq, mockRes, mockNext);

      expect(mockReq.authorization_scheme).to.eql({
        and: [
          { discriminator: 'Team', entity: 'submission', submissionUuid },
          { discriminator: 'Contributor', clientId: selection.expected }
        ]
      });
      expect(mockNext).to.have.been.calledOnce;
    });
  }

  it('rejects unauthorized users before processing the upload', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    try {
      await (POST[0] as RequestHandler)(mockReq, mockRes, mockNext);
      expect.fail('Expected authorization failure');
    } catch (error_) {
      expect(error_).to.be.instanceOf(HTTP403);
    }
    expect(mockNext).not.to.have.been.called;
  });

  it('passes submitter identities and Blueprint selection to the upload service', async () => {
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
    mockReq.body = { bytes: 12345, submitters: mockSubmitters, blueprint_id: 7 };
    mockReq.keycloak_token = { clientId: 'sims-service-client' };

    await requestHandler(mockReq, mockRes, mockNext);

    expect(startAppendStub).to.have.been.calledOnceWith({
      bytes: 12345,
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
    mockReq.body = { bytes: 12345, submitters: mockSubmitters, blueprint_id: 7 };
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
