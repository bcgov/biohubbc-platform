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

  describe('insertSubmissionUploadReview', () => {
    it('returns the inserted review row', async () => {
      const review = buildReview({ submission_upload_review_id: '11111111-1111-4111-8111-111111111111' });
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionUploadReview({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).to.contain('ON CONFLICT');
    });

    it('returns the existing review row when an active review already exists for the upload and scope', async () => {
      const review = buildReview({ submission_upload_review_id: '22222222-2222-4222-8222-222222222222' });
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repository.insertSubmissionUploadReview({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).to.contain('UNION ALL');
    });

    it('throws ApiExecuteSQLError when the insert statement returns an unexpected row count', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.insertSubmissionUploadReview({
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          scope: SubmissionUploadReviewScope.SECURITY,
          requested_by: 7
        });

        expect.fail('Expected ApiExecuteSQLError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert submission_upload_review record');
      }

      expect(sqlStub.calledOnce).to.equal(true);
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
        await repository.updateSubmissionUploadReview({
          submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
          submissionUploadReviewId: '11111111-1111-4111-8111-111111111111',
          data: { status: SubmissionUploadReviewStatus.COMPLETED }
        });

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
        await repository.deleteSubmissionUploadReview({
          submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
          submissionUploadReviewId: '11111111-1111-4111-8111-111111111111'
        });

        expect.fail('Expected ApiExecuteSQLError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to soft-delete submission_upload_review record');
      }
    });
  });
});

const buildReview = (params: { submission_upload_review_id: string }): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: SubmissionUploadReviewScope.SECURITY,
  status: SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
