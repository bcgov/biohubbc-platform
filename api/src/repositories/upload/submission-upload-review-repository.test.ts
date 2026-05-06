import { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../models/submission-upload-review';
import { SubmissionUploadReviewRepository } from './submission-upload-review-repository';

describe('SubmissionUploadReviewRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionUploadReview', () => {
    it('returns the inserted review row', async () => {
      const review = buildReview({ submission_upload_review_id: 1 });
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionUploadReview({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledOnce).to.equal(true);
    });
  });

  describe('updateReviewStatus', () => {
    it('returns undefined when no active review row is updated', async () => {
      const repository = new SubmissionUploadReviewRepository(
        getMockDBConnection({
          sql: sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>)
        })
      );

      const result = await repository.updateReviewStatus({
        submissionUploadReviewId: 1,
        data: { status: SubmissionUploadReviewStatus.COMPLETED }
      });

      expect(result).to.equal(undefined);
    });
  });
});

const buildReview = (params: { submission_upload_review_id: number }): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: SubmissionUploadReviewScope.SECURITY,
  status: SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
