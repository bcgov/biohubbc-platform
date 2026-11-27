import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { getOperationHandler } from '../../../__mocks__/operation';
import { SYSTEM_ROLE } from '../../../constants/roles';
import * as db from '../../../database/db';
import { HTTP400, HTTP403, HTTPError } from '../../../errors/http-error';
import { SubmissionRecordWithSecurity } from '../../../repositories/submission-repository';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';

chai.use(sinonChai);

describe('index', () => {
  describe('GET authorization', () => {
    afterEach(() => {
      sinon.restore();
    });

    it("authorizes only the submission's team and data administrators", async () => {
      sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7' };

      await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);

      expect(mockReq.authorization_scheme).to.eql({
        or: [
          { discriminator: 'Team', entity: 'submission', submissionId: 7 },
          { discriminator: 'SystemRole', validSystemRoles: [SYSTEM_ROLE.DATA_ADMINISTRATOR] }
        ]
      });
      expect(mockNext).to.have.been.calledOnce;
    });

    it('rejects users outside the submission team before loading the submission', async () => {
      sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const getSubmissionStub = sinon.stub(
        SubmissionService.prototype,
        'getSubmissionRecordBySubmissionIdWithSecurity'
      );
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { submissionId: '7' };

      try {
        await getOperationHandler(index.GET, 0)(mockReq, mockRes, mockNext);
        expect.fail('Expected authorization failure');
      } catch (error_) {
        expect(error_).to.be.instanceOf(HTTP403);
      }

      expect(mockNext).not.to.have.been.called;
      expect(getSubmissionStub).not.to.have.been.called;
    });

    it('documents bearer authentication only, with no anonymous access', () => {
      expect(index.GET.apiDoc?.security).to.eql([{ Bearer: [] }]);
    });
  });

  describe('getSubmissionRecordWithSecurity', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws error if submissionService throws error', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionAndFeaturesBySubmissionIdStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionIdWithSecurity')
        .throws(new HTTP400('Error', ['Error']));

      const requestHandler = index.getSubmissionRecordWithSecurity();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionId: '1'
      };

      try {
        await requestHandler(mockReq, mockRes, mockNext);

        expect.fail();
      } catch (error) {
        expect(getSubmissionAndFeaturesBySubmissionIdStub).to.have.been.calledOnce;
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('Error');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockResponse = { submissionId: 1 } as unknown as SubmissionRecordWithSecurity;

      const getSubmissionAndFeaturesBySubmissionIdStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionIdWithSecurity')
        .resolves(mockResponse);

      const requestHandler = index.getSubmissionRecordWithSecurity();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionId: '1'
      };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSubmissionAndFeaturesBySubmissionIdStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.eql(200);
      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
