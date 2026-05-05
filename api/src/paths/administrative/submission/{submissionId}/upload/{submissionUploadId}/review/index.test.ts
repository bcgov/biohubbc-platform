import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../__mocks__/db';
import * as db from '../../../../../../../database/db';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../../../../../../models/submission-upload-review';
import { SubmissionUploadReviewService } from '../../../../../../../services/upload/submission-upload-review-service';
import { insertSubmissionUploadReview } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/review', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('POST inserts a scoped upload review', async () => {
    const mockDBConnection = getMockDBConnection({
      systemUserId: () => 7,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const submissionUploadId = '550e8400-e29b-41d4-a716-446655440000';
    const review = buildReview({ submission_upload_review_id: 1, scope: SubmissionUploadReviewScope.SECURITY });
    const insertSubmissionUploadReviewStub = sinon
      .stub(SubmissionUploadReviewService.prototype, 'insertSubmissionUploadReview')
      .resolves(review);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: '11111111-1111-1111-1111-111111111111', submissionUploadId };
    mockReq.body = { scope: 'security' };

    await insertSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(insertSubmissionUploadReviewStub).to.have.been.calledOnceWith({
      submission_upload_id: submissionUploadId,
      scope: SubmissionUploadReviewScope.SECURITY,
      requested_by: 7
    });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(review);
  });
});

const buildReview = (params: {
  submission_upload_review_id: number;
  scope: SubmissionUploadReviewScope;
}): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: params.scope,
  status: SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7,
  create_date: '2026-05-05T00:00:00.000Z',
  create_user: 7,
  update_date: null,
  update_user: null,
  revision_count: 0,
  record_end_date: null
});
