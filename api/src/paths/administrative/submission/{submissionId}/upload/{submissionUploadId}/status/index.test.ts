import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { SubmissionUploadReviewStatusService } from '../../../../../../../services/upload/submission-upload-review-status-service';
import { updateSubmissionUploadReviewStatus } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/status', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH delegates approval status updates to the service', async () => {
    registerConnection();
    const getSubmissionUploadStub = sinon
      .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid')
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

    expect(getSubmissionUploadStub).to.have.been.calledOnceWith(
      '11111111-1111-1111-1111-111111111111',
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
      status: 'approved'
    });
    expect(mockRes.statusValue).to.equal(200);
  });

  it('PATCH delegates denial status updates to the service', async () => {
    registerConnection();
    const getSubmissionUploadStub = sinon
      .stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid')
      .resolves();
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

    expect(getSubmissionUploadStub).to.have.been.calledOnceWith(
      '11111111-1111-1111-1111-111111111111',
      '550e8400-e29b-41d4-a716-446655440000'
    );
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
