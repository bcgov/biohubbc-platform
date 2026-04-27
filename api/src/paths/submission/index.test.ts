import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissions } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { ApiError } from '../../errors/api-error';
import { SECURITY_APPLIED_STATUS } from '../../repositories/security-repository';
import { SubmissionRecordWithSecurityAndRootFeatureType } from '../../repositories/submission-repository';
import { SubmissionService } from '../../services/submission-service';

chai.use(sinonChai);

describe('submission index', () => {
  afterEach(() => {
    sinon.restore();
  });

  const systemUserId = 42;

  const mockSubmission: SubmissionRecordWithSecurityAndRootFeatureType = {
    submission_id: 1,
    uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    publish_timestamp: null,
    submitted_timestamp: '2025-01-15T12:00:00.000Z',
    system_user_id: systemUserId,
    contributor_id: 10,
    name: 'Test submission',
    description: 'A description',
    comment: '',
    create_user: 10,
    update_user: null,
    security: SECURITY_APPLIED_STATUS.PENDING,
    root_feature_type_id: 3,
    root_feature_type_name: 'Species',
    regions: ['Region A']
  };

  describe('getSubmissions', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getSubmissions();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('calls paginated submission service methods for the current user and returns 200', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => systemUserId,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const submissionStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionsByUserId')
        .resolves([mockSubmission]);
      const countStub = sinon.stub(SubmissionService.prototype, 'getSubmissionsByUserIdCount').resolves(1);

      const requestHandler = getSubmissions();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(submissionStub).to.have.been.calledOnce;
      expect(countStub).to.have.been.calledOnce;
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.have.keys(['submissions', 'pagination']);
      expect(mockRes.jsonValue.submissions).to.eql([mockSubmission]);
      expect(mockRes.jsonValue.pagination.total).to.equal(1);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => systemUserId,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SubmissionService.prototype, 'getSubmissionsByUserId').rejects(new Error('Service error'));
      sinon.stub(SubmissionService.prototype, 'getSubmissionsByUserIdCount').resolves(0);

      const requestHandler = getSubmissions();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});
