import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  SubmissionUploadReview,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus
} from '../../models/submission-upload-review';
import { SubmissionUploadReviewRepository } from '../../repositories/upload/submission-upload-review-repository';
import { SubmissionUploadReviewService } from './submission-upload-review-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSubmissionUploadReview', () => {
    it('inserts a requested review row when no active review exists for the scope', async () => {
      const review = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const insertStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'insertSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.insertSubmissionUploadReview({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(insertStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });
    });

    it('returns the existing active review when one already exists for the scope', async () => {
      const review = buildReview({
        submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const insertStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'insertSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.insertSubmissionUploadReview({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(insertStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });
    });
  });

  describe('requestDefaultReviewsForUpload', () => {
    it('requests validation and security reviews for an upload', async () => {
      const validationReview = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.VALIDATION
      });
      const securityReview = buildReview({
        submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const insertSubmissionUploadReviewStub = sinon
        .stub(SubmissionUploadReviewService.prototype, 'insertSubmissionUploadReview')
        .onFirstCall()
        .resolves(validationReview)
        .onSecondCall()
        .resolves(securityReview);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.requestDefaultReviewsForUpload({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        requestedBy: 7
      });

      expect(result).to.eql([validationReview, securityReview]);
      expect(insertSubmissionUploadReviewStub.firstCall).to.have.been.calledWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.VALIDATION,
        requested_by: 7
      });
      expect(insertSubmissionUploadReviewStub.secondCall).to.have.been.calledWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });
    });
  });

  describe('updateSubmissionUploadReview', () => {
    it('updates a review for a submission upload', async () => {
      const review = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.IN_PROGRESS
      });
      const updateStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'updateSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReview({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: '11111111-1111-4111-8111-111111111111',
        data: { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      });

      expect(result).to.eql(review);
      expect(updateStub).to.have.been.calledOnceWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: '11111111-1111-4111-8111-111111111111',
        data: { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      });
    });
  });

  describe('deleteSubmissionUploadReview', () => {
    it('soft deletes a review for a submission upload', async () => {
      const review = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const deleteStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'deleteSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.deleteSubmissionUploadReview({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: '11111111-1111-4111-8111-111111111111'
      });

      expect(result).to.eql(review);
      expect(deleteStub).to.have.been.calledOnceWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: '11111111-1111-4111-8111-111111111111'
      });
    });
  });
});

const buildReview = (params: {
  submission_upload_review_id: string;
  scope: SubmissionUploadReviewScope;
  status?: SubmissionUploadReviewStatus;
}): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: params.scope,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
