import { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
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

  describe('requestReview', () => {
    it('returns the inserted review when no active review exists', async () => {
      const review = buildReview({ submission_upload_review_id: 1 });
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.requestReview({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requestedBy: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledOnce).to.equal(true);
    });

    it('returns the existing active review when the guarded insert does not create a row', async () => {
      const review = buildReview({ submission_upload_review_id: 2 });
      const sqlStub = sinon
        .stub()
        .onFirstCall()
        .resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>)
        .onSecondCall()
        .resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.requestReview({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requestedBy: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledTwice).to.equal(true);
    });
  });

  describe('updateReviewStatus', () => {
    it('throws when no active review row is updated', async () => {
      const repository = new SubmissionUploadReviewRepository(
        getMockDBConnection({ sql: sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>) })
      );

      try {
        await repository.updateReviewStatus({
          submissionUploadReviewId: 1,
          status: SubmissionUploadReviewStatus.COMPLETED,
          userId: 7
        });
        expect.fail('Expected ApiExecuteSQLError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update submission_upload_review record');
      }
    });
  });

  describe('hasUnresolvedRequiredReviews', () => {
    it('returns whether required reviews are unresolved', async () => {
      const repository = new SubmissionUploadReviewRepository(
        getMockDBConnection({
          sql: sinon.stub().resolves({
            rowCount: 1,
            rows: [{ has_unresolved_required_reviews: true }]
          } as QueryResult<{ has_unresolved_required_reviews: boolean }>)
        })
      );

      const result = await repository.hasUnresolvedRequiredReviews('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.equal(true);
    });
  });
});

const buildReview = (params: { submission_upload_review_id: number }): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: SubmissionUploadReviewScope.SECURITY,
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
