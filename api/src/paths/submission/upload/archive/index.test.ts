import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { POST, startUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { dbDependencies } from '../../../../database/db';
import { HTTP403 } from '../../../../errors/http-error';
import { SystemUserExtended } from '../../../../models/system-user';
import { ContributorRepository } from '../../../../repositories/contributor-repository';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { PresignedUploadUrlResponse } from '../../../../services/upload/upload-ingestion-service.interface';

describe('Submission upload request contributor selection', () => {
  afterEach(() => sinon.restore());

  for (const selection of [
    { body: 'selected-client', token: { clientId: 'token-client' }, expected: 'selected-client' },
    { body: undefined, token: { clientId: 'token-client' }, expected: 'token-client' },
    { body: undefined, token: { azp: 'authorized-party' }, expected: 'authorized-party' }
  ]) {
    it(`authorizes the effective client ID (${selection.expected}) and forwards the resolved contributor ID`, async () => {
      const connection = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
      const response = { submissionUuid: 'submission-uuid' } as PresignedUploadUrlResponse;
      const uploadOperation = sinon
        .stub(UploadIngestionService.prototype, 'createSubmissionArchiveUpload')
        .resolves(response);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      const submitters = [{ guid: 'user-guid', identifier: 'user', identitySource: 'IDIR' }];
      mockReq.body = {
        client_id: selection.body,
        bytes: 100,
        name: 'Name',
        description: 'Description',
        comment: 'Comment',
        submitters,
        blueprint_id: 7
      };
      mockReq.keycloak_token = selection.token;
      mockReq.system_user = { system_user_id: 5, role_names: [] } as unknown as SystemUserExtended;
      sinon.stub(authorizationDependencies, 'getAPIUserDBConnection').returns(getMockDBConnection());
      const membership = sinon
        .stub(ContributorRepository.prototype, 'findContributorMembershipByClientId')
        .withArgs(selection.expected, 5)
        .resolves({ contributor_id: 77, is_member: true });
      await (POST[0] as RequestHandler)(mockReq, mockRes, mockNext);
      expect(mockReq.authorization_scheme).eql({
        or: [{ discriminator: 'Contributor', clientId: selection.expected }]
      });
      await startUpload()(mockReq, mockRes, mockNext);
      expect(membership.calledOnceWithExactly(selection.expected, 5)).is.true;
      expect(uploadOperation.calledOnce).is.true;
      expect(uploadOperation.firstCall.args[0]).eql({
        contributorId: 77,
        bytes: 100,
        name: 'Name',
        description: 'Description',
        comment: 'Comment',
        submitters,
        blueprintId: 7
      });
      expect(mockRes.statusValue).equals(201);
      expect(mockRes.jsonValue).eql(response);
      expect((connection.commit as sinon.SinonStub).calledOnce).is.true;
      expect((connection.release as sinon.SinonStub).calledOnce).is.true;
    });
  }

  it('rolls back and releases when upload creation fails', async () => {
    const connection = getMockDBConnection({ commit: sinon.stub(), rollback: sinon.stub(), release: sinon.stub() });
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    sinon
      .stub(UploadIngestionService.prototype, 'createSubmissionArchiveUpload')
      .rejects(new HTTP403('Not authorized'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = { clientId: 'token-client' };
    try {
      await startUpload()(mockReq, mockRes, mockNext);
      expect.fail('Expected authorization failure');
    } catch (error) {
      expect(error).instanceOf(HTTP403);
    }
    expect((connection.commit as sinon.SinonStub).called).is.false;
    expect((connection.rollback as sinon.SinonStub).calledOnce).is.true;
    expect((connection.release as sinon.SinonStub).calledOnce).is.true;
  });

  it('retains endpoint authorization before processing an upload', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    try {
      await (POST[0] as RequestHandler)(mockReq, mockRes, mockNext);
      expect.fail('Expected authorization failure');
    } catch (error) {
      expect(error).instanceOf(HTTP403);
    }
    expect(mockNext.called).is.false;
  });
});
