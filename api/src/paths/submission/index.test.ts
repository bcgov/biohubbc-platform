import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getSubmissions } from '.';
import * as db from '../../database/db';
import { ApiError } from '../../errors/api-error';
import { SECURITY_APPLIED_STATUS } from '../../repositories/security-repository';
import { SubmissionRecordWithSecurityAndRootFeatureType } from '../../repositories/submission-repository';
import { SubmissionService } from '../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';

chai.use(sinonChai);

describe('submission index', () => {
  afterEach(() => {
    sinon.restore();
  });

  const systemUserId = 42;

  const mockSubmission: SubmissionRecordWithSecurityAndRootFeatureType = {
    submission_id: 1,
    uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    security_review_timestamp: null,
    publish_timestamp: null,
    submitted_timestamp: '2025-01-15T12:00:00.000Z',
    system_user_id: systemUserId,
    contributor_id: 10,
    name: 'Test submission',
    description: 'A description',
    comment: '',
    record_end_date: null,
    create_date: '2025-01-10T00:00:00.000Z',
    create_user: 10,
    update_date: null,
    update_user: null,
    revision_count: 0,
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
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
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

    it('calls SubmissionService.getSubmissionsByUserId for the current user and returns 200', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => systemUserId,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const stub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionsByUserId')
        .resolves([mockSubmission]);

      const requestHandler = getSubmissions();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(stub).to.have.been.calledOnceWith(systemUserId);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([mockSubmission]);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        systemUserId: () => systemUserId,
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(SubmissionService.prototype, 'getSubmissionsByUserId').rejects(new Error('Service error'));

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
