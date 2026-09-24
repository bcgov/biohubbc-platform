import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { completeUpload, PUT } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import * as db from '../../../database/db';
import { HTTP403 } from '../../../errors/http-error';
import { SystemUserExtended } from '../../../models/system-user';
import { UploadRepository } from '../../../repositories/upload/upload-repository';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
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
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

    const completeArchiveUploadStub = sinon.stub(UploadIngestionService.prototype, 'completeArchiveUpload').resolves();

    const requestHandler = completeUpload();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      uploadId: 'mock-upload-id',
      uploadArchiveId: 'mock-archive-id'
    };
    mockReq.body = {
      uploadId: 'body-cannot-override-authorized-upload',
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
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

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
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

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
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

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

describe('Upload authorization middleware', () => {
  afterEach(() => sinon.restore());

  for (const administrator of [false, true]) {
    for (const creator of [false, true]) {
      for (const member of [false, true]) {
        it(`requires the creator and owner membership (admin=${administrator}, creator=${creator}, member=${member})`, async () => {
          sinon
            .stub(authorizationDependencies, 'getAPIUserDBConnection')
            .returns(getMockDBConnection({ systemUserId: () => 999 }));
          const access = sinon
            .stub(UploadRepository.prototype, 'findUploadCompletionAccess')
            .withArgs('upload', 5)
            .resolves({ create_user: creator ? 5 : 6, is_contributor_member: member });
          const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
          mockReq.params = { uploadId: 'upload' };
          mockReq.keycloak_token = { sub: 'user' };
          mockReq.system_user = {
            system_user_id: 5,
            role_names: administrator ? [SYSTEM_ROLE.SYSTEM_ADMIN] : []
          } as SystemUserExtended;
          let failure: unknown;
          try {
            await (PUT[0] as RequestHandler)(mockReq, mockRes, mockNext);
          } catch (error_) {
            failure = error_;
          }
          expect(access).to.have.been.calledOnceWithExactly('upload', 5);
          if (creator && (member || administrator)) {
            expect(failure).to.be.undefined;
            expect(mockNext).to.have.been.calledOnce;
          } else {
            expect(failure).to.be.instanceOf(HTTP403);
            expect(mockNext).not.to.have.been.called;
          }
        });
      }
    }

    it(`rejects a missing active submission association (admin=${administrator})`, async () => {
      sinon.stub(authorizationDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
      sinon.stub(UploadRepository.prototype, 'findUploadCompletionAccess').resolves(undefined);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { uploadId: 'missing' };
      mockReq.keycloak_token = { sub: 'user' };
      mockReq.system_user = {
        system_user_id: 5,
        role_names: administrator ? [SYSTEM_ROLE.SYSTEM_ADMIN] : []
      } as SystemUserExtended;
      try {
        await (PUT[0] as RequestHandler)(mockReq, mockRes, mockNext);
        expect.fail('Expected authorization rejection');
      } catch (error_) {
        expect(error_).to.be.instanceOf(HTTP403);
      }
      expect(mockNext).not.to.have.been.called;
    });
  }

  for (const user of [null, { system_user_id: 5, record_end_date: '2026-01-01', role_names: [] }]) {
    it('rejects an unknown or inactive caller without checking upload access', async () => {
      sinon.stub(authorizationDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
      const access = sinon.stub(UploadRepository.prototype, 'findUploadCompletionAccess');
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { uploadId: 'upload' };
      mockReq.keycloak_token = { sub: 'user' };
      mockReq.system_user = user as unknown as SystemUserExtended;
      try {
        await (PUT[0] as RequestHandler)(mockReq, mockRes, mockNext);
        expect.fail('Expected authorization rejection');
      } catch (error_) {
        expect(error_).to.be.instanceOf(HTTP403);
      }
      expect(access).not.to.have.been.called;
      expect(mockNext).not.to.have.been.called;
    });
  }
});
