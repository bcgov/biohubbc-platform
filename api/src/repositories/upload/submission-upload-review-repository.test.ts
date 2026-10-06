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

      const result = await repository.insertSubmissionUploadReview(17, {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Access rules',
        description: 'Review access rules',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.REQUESTED,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(sqlStub.calledOnce).to.equal(true);
      expect(sqlStub.firstCall.args[0].text).not.to.contain('ON CONFLICT');
      expect(sqlStub.firstCall.args[0].text).to.contain('::submission_upload_review_status');
    });

    it('throws ApiNotFoundError when the submission upload does not belong to the submission', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      try {
        await repository.insertSubmissionUploadReview(17, {
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Access rules',
          description: 'Review access rules',
          scope: SubmissionUploadReviewScope.SECURITY,
          status: SubmissionUploadReviewStatus.REQUESTED,
          requested_by: 7
        });

        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload not found');
      }

      expect(sqlStub.calledOnce).to.equal(true);
    });

    it('uses an append-only insert with no conflict or update clause', async () => {
      const review = buildReview({ submission_upload_review_id: '11111111-1111-4111-8111-111111111111' });
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [review] } as QueryResult<SubmissionUploadReview>);
      const repository = new SubmissionUploadReviewRepository(getMockDBConnection({ sql: sqlStub }));

      await repository.insertSubmissionUploadReview(17, {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Access rules',
        description: 'Review access rules',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.IN_PROGRESS,
        requested_by: 7
      });

      expect(sqlStub.firstCall.args[0].text).not.to.contain('ON CONFLICT');
      expect(sqlStub.firstCall.args[0].text).not.to.contain('UPDATE submission_upload_review');
      expect(sqlStub.firstCall.args[0].text).not.to.contain('SET record_end_date');
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
          17,
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
          17,
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
  name: 'Access rules',
  description: 'Review access rules',
  scope: params.scope ?? SubmissionUploadReviewScope.SECURITY,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
