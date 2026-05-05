import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import { HTTP400 } from '../../../../../../../errors/http-error';
import { SubmissionValidationService } from '../../../../../../../services/submission-validation-service';
import { SubmissionUploadReviewService } from '../../../../../../../services/upload/submission-upload-review-service';
import { SubmissionUploadReviewStatusService } from '../../../../../../../services/upload/submission-upload-review-status-service';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { updateSubmissionUploadReviewStatus } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/status', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH blocks approval when automated validation is not completed', async () => {
    registerConnection();
    stubUploadOwnership();
    sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
      submission_validation_id: 1,
      job_id: 'job-1',
      status: 'started'
    });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '11111111-1111-1111-1111-111111111111',
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000'
    };
    mockReq.body = { status: 'approved' };

    try {
      await updateSubmissionUploadReviewStatus()(mockReq, mockRes, mockNext);
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
      expect((error as HTTP400).message).to.equal('Submission upload validation must be completed before approval');
    }
  });

  it('PATCH gates approval on resolved scoped reviews', async () => {
    registerConnection();
    stubUploadOwnership();
    sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
      submission_validation_id: 1,
      job_id: 'job-1',
      status: 'completed'
    });
    const gateStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'assertRequiredReviewsResolvedForApproval')
      .resolves();
    const updateStatusStub = sinon
      .stub(SubmissionUploadReviewStatusService.prototype, 'updateSubmissionUploadReviewStatus')
      .resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '11111111-1111-1111-1111-111111111111',
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000'
    };
    mockReq.body = { status: 'approved' };

    await updateSubmissionUploadReviewStatus()(mockReq, mockRes, mockNext);

    expect(gateStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
    expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
      status: 'approved'
    });
    expect(mockRes.statusValue).to.equal(200);
  });

  it('PATCH allows denial without review gating', async () => {
    registerConnection();
    stubUploadOwnership();
    const validationStub = sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId');
    const gateStub = sinon.stub(SubmissionUploadReviewService.prototype, 'assertRequiredReviewsResolvedForApproval');
    const updateStatusStub = sinon
      .stub(SubmissionUploadReviewStatusService.prototype, 'updateSubmissionUploadReviewStatus')
      .resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'denied'
      });

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '11111111-1111-1111-1111-111111111111',
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000'
    };
    mockReq.body = { status: 'denied' };

    await updateSubmissionUploadReviewStatus()(mockReq, mockRes, mockNext);

    expect(validationStub).not.to.have.been.called;
    expect(gateStub).not.to.have.been.called;
    expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
      status: 'denied'
    });
    expect(mockRes.statusValue).to.equal(200);
  });
});

const registerConnection = () => {
  const mockDBConnection = getMockDBConnection({
    commit: sinon.stub(),
    rollback: sinon.stub(),
    release: sinon.stub()
  });
  sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
};

const stubUploadOwnership = () => {
  return sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid').resolves({
    submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
    submission_id: 1,
    upload_id: '22222222-2222-2222-2222-222222222222',
    ticket_id: '33333333-3333-3333-3333-333333333333',
    status: 'uploaded'
  });
};
