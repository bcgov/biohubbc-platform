import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { deleteSubmissionUpload } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { getOperationHandler } from '../../../../../__mocks__/operation';
import * as db from '../../../../../database/db';
import { authorizationDependencies } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

describe('delete submission upload handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('delegates submission upload deletion to the service', async () => {
    const connection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);

    const submissionUuid = '11111111-1111-1111-1111-111111111111';
    const submissionUploadId = '22222222-2222-2222-2222-222222222222';
    const deleteStub = sinon.stub(SubmissionUploadService.prototype, 'deleteSubmissionUpload').resolves();

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid, submissionUploadId };

    await deleteSubmissionUpload()(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith(submissionUuid, submissionUploadId);
    expect(connection.commit).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(204);
  });

  it('rolls back when the service rejects deletion', async () => {
    const connection = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);

    const submissionUploadId = '22222222-2222-2222-2222-222222222222';
    sinon.stub(SubmissionUploadService.prototype, 'deleteSubmissionUpload').rejects(new Error('Delete failed'));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionUuid: '11111111-1111-1111-1111-111111111111',
      submissionUploadId
    };

    try {
      await deleteSubmissionUpload()(mockReq, mockRes, mockNext);
      expect.fail('Expected reviewed upload deletion to fail');
    } catch {
      expect(connection.rollback).to.have.been.calledOnce;
      expect(connection.commit).not.to.have.been.called;
    }
  });
});

describe('get submission upload handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  const submissionUuid = '11111111-1111-1111-1111-111111111111';
  const submissionUploadId = '22222222-2222-2222-2222-222222222222';

  it("authorizes only the submission's team", async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid, submissionUploadId };

    await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ discriminator: 'Team', entity: 'submission', submissionUuid }]
    });
    expect(index.GET.apiDoc?.security).to.eql([{ Bearer: [] }]);
  });

  it("returns the upload's identifier, status, decision and creation date only", async () => {
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const readStub = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid').resolves({
      submission_upload_id: submissionUploadId,
      submission_id: 7,
      upload_id: '33333333-3333-3333-3333-333333333333',
      team_id: '44444444-4444-4444-4444-444444444444',
      status: 'indexed',
      decision: 'pending',
      ticket_id: '55555555-5555-5555-5555-555555555555',
      blueprint_id: 1,
      comment: 'internal',
      create_date: '2026-11-27T12:00:00.000Z'
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.keycloak_token = {};
    mockReq.params = { submissionUuid, submissionUploadId };

    await index.getSubmissionUpload()(mockReq, mockRes, mockNext);

    expect(readStub).to.have.been.calledOnceWith(submissionUuid, submissionUploadId);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      submission_upload_id: submissionUploadId,
      status: 'indexed',
      decision: 'pending',
      create_date: '2026-11-27T12:00:00.000Z'
    });
  });
});
