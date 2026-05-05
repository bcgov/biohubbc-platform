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
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { requestSubmissionUploadReview } from './index';

chai.use(sinonChai);

describe('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/review', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('POST requests a scoped upload review after validating upload ownership', async () => {
    const mockDBConnection = getMockDBConnection({
      systemUserId: () => 7,
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
    const submissionUuid = '11111111-1111-1111-1111-111111111111';
    const submissionUploadId = '550e8400-e29b-41d4-a716-446655440000';
    const review = buildReview({ submission_upload_review_id: 1, scope: SubmissionUploadReviewScope.SECURITY });
    const ownershipStub = sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadBySubmissionUuid').resolves({
      submission_upload_id: submissionUploadId,
      submission_id: 1,
      upload_id: '22222222-2222-2222-2222-222222222222',
      ticket_id: '33333333-3333-3333-3333-333333333333',
      status: 'uploaded'
    });
    const requestReviewStub = sinon.stub(SubmissionUploadReviewService.prototype, 'requestReview').resolves(review);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { submissionId: submissionUuid, submissionUploadId };
    mockReq.body = { scope: 'security', note: 'scan it', metadata: { source: 'admin' } };

    await requestSubmissionUploadReview()(mockReq, mockRes, mockNext);

    expect(ownershipStub).to.have.been.calledOnceWith(submissionUuid, submissionUploadId);
    expect(requestReviewStub).to.have.been.calledOnceWith({
      submissionUploadId,
      scope: SubmissionUploadReviewScope.SECURITY,
      requestedBy: 7,
      note: 'scan it',
      metadata: { source: 'admin' }
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
  requested_at: '2026-05-05T00:00:00.000Z',
  assigned_to: null,
  started_at: null,
  completed_by: null,
  completed_at: null,
  note: null,
  metadata: null,
  create_date: '2026-05-05T00:00:00.000Z',
  create_user: 7,
  update_date: null,
  update_user: null,
  revision_count: 0,
  record_end_date: null
});
