import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { PATCH, updateSubmissionUploadDecision } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import * as db from '../../../../../../../database/db';
import { HTTP409 } from '../../../../../../../errors/http-error';
import { authorizationDependencies } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';

chai.use(sinonChai);

const SUBMISSION_UUID = '11111111-1111-1111-1111-111111111111';
const SUBMISSION_UPLOAD_ID = '22222222-2222-2222-2222-222222222222';

describe('submission upload decision handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('authorizes system administrators only', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: SUBMISSION_UUID, submissionUploadId: SUBMISSION_UPLOAD_ID };

    await (PATCH[0] as RequestHandler)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('verifies the upload belongs to the submission, records the decision and commits', async () => {
    const connection = stubConnection();
    const ownershipStub = sinon
      .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid')
      .resolves();
    const decisionStub = sinon
      .stub(SubmissionUploadService.prototype, 'updateSubmissionUploadDecision')
      .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'approved' });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: SUBMISSION_UUID, submissionUploadId: SUBMISSION_UPLOAD_ID };
    mockReq.body = { decision: 'approved' };

    await updateSubmissionUploadDecision()(mockReq, mockRes, mockNext);

    expect(ownershipStub).to.have.been.calledOnceWith(SUBMISSION_UUID, SUBMISSION_UPLOAD_ID);
    expect(decisionStub).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID, { decision: 'approved' });
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'approved' });
  });

  it('rolls back and rethrows when the decision is refused', async () => {
    const connection = stubConnection();
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid').resolves();
    const refusal = new HTTP409('Submission uploads with activated features are immutable.');
    sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUploadDecision').rejects(refusal);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: SUBMISSION_UUID, submissionUploadId: SUBMISSION_UPLOAD_ID };
    mockReq.body = { decision: 'denied' };

    try {
      await updateSubmissionUploadDecision()(mockReq, mockRes, mockNext);
      expect.fail('Expected the refusal to propagate');
    } catch (error) {
      expect(error).to.equal(refusal);
    }

    expect(connection.commit).not.to.have.been.called;
    expect(connection.rollback).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});

/**
 * Stub the request-scoped database connection.
 *
 * @returns {ReturnType<typeof getMockDBConnection>} Connection whose lifecycle methods are spies.
 */
const stubConnection = () => {
  const connection = getMockDBConnection({
    open: sinon.stub().resolves(),
    commit: sinon.stub().resolves(),
    rollback: sinon.stub().resolves(),
    release: sinon.stub()
  });
  sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
  return connection;
};
