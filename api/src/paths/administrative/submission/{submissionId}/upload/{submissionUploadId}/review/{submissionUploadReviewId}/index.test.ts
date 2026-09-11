import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../../../__mocks__/db';
import * as db from '../../../../../../../../database/db';
import { SubmissionUploadReviewService } from '../../../../../../../../services/upload/submission-upload-review-service';

chai.use(sinonChai);

describe('getSubmissionUploadReview', () => {
  afterEach(() => sinon.restore());

  it('returns the requested review belonging to the submission upload', async () => {
    const connection = getMockDBConnection();
    sinon.stub(db.dbDependencies, 'getDBConnection').returns(connection);
    sinon.stub(connection, 'open').resolves();
    sinon.stub(connection, 'commit').resolves();
    sinon.stub(connection, 'release').resolves();

    const review = {
      submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
      submission_upload_id: '11111111-1111-4111-8111-111111111111',
      name: 'Validation pass',
      description: 'Check the features',
      scope: 'validation' as const,
      status: 'in_progress' as const,
      requested_by: 1
    };
    const getReview = sinon.stub(SubmissionUploadReviewService.prototype, 'getSubmissionUploadReview').resolves(review);
    const { mockReq, mockRes } = getRequestHandlerMocks();
    mockReq.params = {
      submissionId: '16',
      submissionUploadId: review.submission_upload_id,
      submissionUploadReviewId: review.submission_upload_review_id
    };

    await index.getSubmissionUploadReview()(mockReq, mockRes, () => {});

    expect(getReview).to.have.been.calledWith(16, review.submission_upload_id, review.submission_upload_review_id);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(review);
    expect(connection.commit).to.have.been.calledOnce;
    expect(connection.release).to.have.been.calledOnce;
  });
});
