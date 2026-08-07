import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { GET, getSubmissionHistory } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import * as db from '../../../../database/db';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewStatusService } from '../../../../services/upload/submission-upload-review-status-service';

chai.use(sinonChai);

describe('submission history handler', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('authorizes submission-team members and system administrators', async () => {
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: '11111111-1111-1111-1111-111111111111' };

    await (GET[0] as RequestHandler)(mockReq, mockRes, mockNext);

    expect(mockReq.authorization_scheme).to.eql({
      or: [
        {
          discriminator: 'Team',
          entity: 'submission',
          submissionUuid: '11111111-1111-1111-1111-111111111111'
        },
        { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }
      ]
    });
    expect(mockNext).to.have.been.calledOnce;
  });

  it('returns submission history after route authorization', async () => {
    const connection = getMockDBConnection({
      systemUserId: () => 42,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    const historyStub = sinon
      .stub(SubmissionUploadReviewStatusService.prototype, 'getSubmissionHistoryByUuid')
      .resolves({ submissionId: 1, history: [] });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUuid: '11111111-1111-1111-1111-111111111111' };
    await getSubmissionHistory()(mockReq, mockRes, mockNext);

    expect(historyStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111');
    expect(mockRes.statusValue).to.equal(200);
  });
});
