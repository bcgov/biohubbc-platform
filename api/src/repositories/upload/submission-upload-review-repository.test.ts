import { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
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
      const review = buildReview({ submission_upload_review_id: '11111111-1111-4111-8111-111111111111' });
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionUploadReview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).not.to.contain('ON CONFLICT');
    });

    it('throws ApiNotFoundError when the submission upload does not belong to the submission', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.insertSubmissionUploadReview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          scope: SubmissionUploadReviewScope.SECURITY,
          requested_by: 7
        });

        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload not found');
      }

      expect(sqlStub.calledOnce).to.equal(true);
    });
  });

  describe('insertDefaultSubmissionUploadReviews', () => {
    it('inserts pending default review rows when a submission upload is created', async () => {
      const reviews = [
        buildReview({
          submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
          scope: SubmissionUploadReviewScope.VALIDATION,
          status: SubmissionUploadReviewStatus.PENDING
        }),
        buildReview({
          submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
          scope: SubmissionUploadReviewScope.SECURITY,
          status: SubmissionUploadReviewStatus.PENDING
        })
      ];
      const sqlStub = sinon.stub().resolves({ rowCount: 2, rows: reviews } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertDefaultSubmissionUploadReviews(
        99,
        '550e8400-e29b-41d4-a716-446655440000',
        7
      );

      expect(result).to.eql(reviews);
      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).to.contain("'pending'::submission_upload_review_status");
      expect(sqlStub.firstCall.args[0].text).not.to.contain('ON CONFLICT');
    });
  });

  describe('requestDefaultSubmissionUploadReviews', () => {
    it('updates default review rows to requested when indexing succeeds', async () => {
      const reviews = [
        buildReview({
          submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
          scope: SubmissionUploadReviewScope.VALIDATION
        }),
        buildReview({
          submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
          scope: SubmissionUploadReviewScope.SECURITY
        })
      ];
      const sqlStub = sinon.stub().resolves({ rowCount: 2, rows: reviews } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.requestDefaultSubmissionUploadReviews(
        99,
        '550e8400-e29b-41d4-a716-446655440000',
        7
      );

      expect(result).to.eql(reviews);
      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).to.contain('UPDATE submission_upload_review');
      expect(sqlStub.firstCall.args[0].text).to.contain("AND sur.status = 'pending'");
      expect(sqlStub.firstCall.args[0].text).to.contain("'requested'::submission_upload_review_status");
    });
  });

  describe('updateSubmissionUploadReview', () => {
    it('throws ApiExecuteSQLError when no active review row is updated', async () => {
      const repository = new SubmissionUploadReviewRepository(
        getMockDBConnection({
          sql: sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>)
        })
      );

      try {
        await repository.updateSubmissionUploadReview(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '550e8400-e29b-41d4-a716-446655440000',
          '11111111-1111-4111-8111-111111111111',
          { status: SubmissionUploadReviewStatus.COMPLETED }
        );

        expect.fail('Expected ApiExecuteSQLError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update submission_upload_review record');
      }
    });
  });

  describe('deleteSubmissionUploadReview', () => {
    it('throws ApiExecuteSQLError when no active review row is deleted', async () => {
      const repository = new SubmissionUploadReviewRepository(
        getMockDBConnection({
          sql: sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>)
        })
      );

      try {
        await repository.deleteSubmissionUploadReview(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '550e8400-e29b-41d4-a716-446655440000',
          '11111111-1111-4111-8111-111111111111'
        );

        expect.fail('Expected ApiExecuteSQLError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to soft-delete submission_upload_review record');
      }
    });
  });
});

const buildReview = (params: {
  submission_upload_review_id: string;
  scope?: SubmissionUploadReviewScope;
  status?: SubmissionUploadReviewStatus;
}): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: params.scope ?? SubmissionUploadReviewScope.SECURITY,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
