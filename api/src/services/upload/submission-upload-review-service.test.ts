import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400 } from '../../errors/http-error';
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

  describe('requestDefaultReviewsForUpload', () => {
    it('requests validation and security reviews for an upload', async () => {
      const validationReview = buildReview({
        submission_upload_review_id: 1,
        scope: SubmissionUploadReviewScope.VALIDATION
      });
      const securityReview = buildReview({
        submission_upload_review_id: 2,
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const requestReviewStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'requestReview')
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
      expect(requestReviewStub.firstCall).to.have.been.calledWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.VALIDATION,
        requestedBy: 7
      });
      expect(requestReviewStub.secondCall).to.have.been.calledWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requestedBy: 7
      });
    });
  });

  describe('assertRequiredReviewsResolvedForApproval', () => {
    it('throws when required reviews are unresolved', async () => {
      sinon.stub(SubmissionUploadReviewRepository.prototype, 'hasUnresolvedRequiredReviews').resolves(true);

      const service = new SubmissionUploadReviewService(getMockDBConnection());

      try {
        await service.assertRequiredReviewsResolvedForApproval('550e8400-e29b-41d4-a716-446655440000');
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload has unresolved required reviews');
      }
    });

    it('allows approval when required reviews are resolved', async () => {
      const unresolvedStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'hasUnresolvedRequiredReviews')
        .resolves(false);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      await service.assertRequiredReviewsResolvedForApproval('550e8400-e29b-41d4-a716-446655440000');

      expect(unresolvedStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
    });
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
