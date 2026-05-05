import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../../../models/submission-upload-review';
import { SubmissionUploadReviewService } from '../../../../services/upload/submission-upload-review-service';
import { updateSubmissionUploadReview } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission-upload-review/{submissionUploadReviewId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('PATCH delegates scoped review status updates to the service', async () => {
    const mockDBConnection = getMockDBConnection({
      systemUserId: () => 7,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const review = buildReview();
    const updateStub = sinon.stub(SubmissionUploadReviewService.prototype, 'updateReviewStatus').resolves(review);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionUploadReviewId: '12' };
    mockReq.body = { status: 'completed' };

    await updateSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(updateStub).to.have.been.calledOnceWith({
      submissionUploadReviewId: 12,
      status: SubmissionUploadReviewStatus.COMPLETED
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(review);
  });
});

const buildReview = (): SubmissionUploadReview => ({
  submission_upload_review_id: 12,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: SubmissionUploadReviewScope.SECURITY,
  status: SubmissionUploadReviewStatus.COMPLETED,
  requested_by: 7,
  create_date: '2026-05-05T00:00:00.000Z',
  create_user: 7,
  update_date: null,
  update_user: null,
  revision_count: 0,
  record_end_date: null
});
