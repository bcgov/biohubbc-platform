import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../../../../../models/submission-upload-review';
import { SubmissionUploadReviewService } from '../../../../../../services/upload/submission-upload-review-service';
import { deleteSubmissionUploadReview, updateSubmissionUploadReview } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission-upload/{submissionUploadId}/review/{submissionUploadReviewId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH updates a scoped upload review', async () => {
    registerConnection();
    const review = buildReview({
      submission_upload_review_id: 1,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.IN_PROGRESS
    });
    const updateStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'updateSubmissionUploadReview')
      .resolves(review);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
      submissionUploadReviewId: '1'
    };
    mockReq.body = { status: 'in_progress' };

    await updateSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith({
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
      submissionUploadReviewId: 1,
      data: { status: SubmissionUploadReviewStatus.IN_PROGRESS }
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(review);
  });

  it('DELETE soft deletes a scoped upload review', async () => {
    registerConnection();
    const deleteStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'deleteSubmissionUploadReview')
      .resolves(buildReview({ submission_upload_review_id: 1, scope: SubmissionUploadReviewScope.SECURITY }));

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = {
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
      submissionUploadReviewId: '1'
    };

    await deleteSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(deleteStub).to.have.been.calledOnceWith({
      submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
      submissionUploadReviewId: 1
    });
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
  submission_upload_review_id: number;
  scope: SubmissionUploadReviewScope;
  status?: SubmissionUploadReviewStatus;
}): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: params.scope,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7,
  create_date: '2026-05-05T00:00:00.000Z',
  create_user: 7,
  update_date: null,
  update_user: null,
  revision_count: 0,
  record_end_date: null
});
