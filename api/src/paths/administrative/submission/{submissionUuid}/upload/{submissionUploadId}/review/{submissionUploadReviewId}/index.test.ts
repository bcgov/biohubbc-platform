import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../database/db';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../../../../../../../models/submission-upload-review';
import { SubmissionUploadReviewService } from '../../../../../../../../services/upload/submission-upload-review-service';
import { deleteSubmissionUploadReview, updateSubmissionUploadReview } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission/{submissionUuid}/upload/{submissionUploadId}/review/{submissionUploadReviewId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH updates a scoped upload review', async () => {
    registerConnection();
    const review = buildReview({
      submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.IN_PROGRESS
    });
    const updateStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'updateSubmissionUploadReview')
      .resolves(review);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
      submissionUploadReviewId: '11111111-1111-4111-8111-111111111111'
    };
    mockReq.body = { status: 'in_progress' };

    await updateSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '550e8400-e29b-41d4-a716-446655440000',
      '11111111-1111-4111-8111-111111111111',
      { status: SubmissionUploadReviewStatus.IN_PROGRESS }
    );
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(review);
  });

  it('DELETE soft deletes a scoped upload review', async () => {
    registerConnection();
    const deleteStub = sinon.stub(SubmissionUploadReviewService.prototype, 'deleteSubmissionUploadReview').resolves(
      buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY
      })
    );

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
      submissionUploadReviewId: '11111111-1111-4111-8111-111111111111'
    };

    await deleteSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '550e8400-e29b-41d4-a716-446655440000',
      '11111111-1111-4111-8111-111111111111'
    );
    expect(mockRes.statusValue).to.equal(204);
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

const buildReview = (params: {
  submission_upload_review_id: string;
  scope: SubmissionUploadReviewScope;
  status?: SubmissionUploadReviewStatus;
}): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: params.scope,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
