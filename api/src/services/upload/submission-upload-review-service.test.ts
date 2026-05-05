import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { ApiNotFoundError } from '../../errors/api-error';
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
        submission_upload_review_id: 1,
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const findReviewsStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId')
        .resolves([]);
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
      expect(findReviewsStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        scope: SubmissionUploadReviewScope.SECURITY
      });
      expect(insertStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });
    });

    it('returns the existing active review when one already exists for the scope', async () => {
      const review = buildReview({
        submission_upload_review_id: 2,
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const findReviewsStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId')
        .resolves([review]);
      const insertStub = sinon.stub(SubmissionUploadReviewRepository.prototype, 'insertSubmissionUploadReview');

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.insertSubmissionUploadReview({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(findReviewsStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        scope: SubmissionUploadReviewScope.SECURITY
      });
      expect(insertStub).not.to.have.been.called;
    });
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

  describe('updateReviewStatus', () => {
    it('throws when no active review row exists', async () => {
      sinon.stub(SubmissionUploadReviewRepository.prototype, 'updateReviewStatus').resolves(undefined);

      const service = new SubmissionUploadReviewService(getMockDBConnection());

      try {
        await service.updateReviewStatus({
          submissionUploadReviewId: 1,
          status: SubmissionUploadReviewStatus.COMPLETED
        });
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload review not found');
      }
    });
  });

  describe('updateSubmissionUploadReview', () => {
    it('updates a review for a submission upload', async () => {
      const review = buildReview({
        submission_upload_review_id: 1,
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.IN_PROGRESS
      });
      const updateStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'updateSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReview({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: 1,
        data: { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      });

      expect(result).to.eql(review);
      expect(updateStub).to.have.been.calledOnceWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: 1,
        data: { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      });
    });

    it('throws when no active review row exists for the upload and ID', async () => {
      sinon.stub(SubmissionUploadReviewRepository.prototype, 'updateSubmissionUploadReview').resolves(undefined);

      const service = new SubmissionUploadReviewService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadReview({
          submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
          submissionUploadReviewId: 1,
          data: { status: SubmissionUploadReviewStatus.IN_PROGRESS }
        });
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload review not found');
      }
    });
  });

  describe('deleteSubmissionUploadReview', () => {
    it('soft deletes a review for a submission upload', async () => {
      const review = buildReview({
        submission_upload_review_id: 1,
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const deleteStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'deleteSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.deleteSubmissionUploadReview({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: 1
      });

      expect(result).to.eql(review);
      expect(deleteStub).to.have.been.calledOnceWith({
        submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
        submissionUploadReviewId: 1
      });
    });

    it('throws when no active review row exists for delete', async () => {
      sinon.stub(SubmissionUploadReviewRepository.prototype, 'deleteSubmissionUploadReview').resolves(undefined);

      const service = new SubmissionUploadReviewService(getMockDBConnection());

      try {
        await service.deleteSubmissionUploadReview({
          submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
          submissionUploadReviewId: 1
        });
        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Submission upload review not found');
      }
    });
  });

  describe('hasUnresolvedRequiredReviews', () => {
    it('returns true when a required review scope is not resolved', async () => {
      const findReviewsStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId')
        .resolves([
          buildReview({
            submission_upload_review_id: 1,
            scope: SubmissionUploadReviewScope.VALIDATION,
            status: SubmissionUploadReviewStatus.COMPLETED
          })
        ]);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.hasUnresolvedRequiredReviews('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.equal(true);
      expect(findReviewsStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('returns false when validation and security reviews are resolved', async () => {
      sinon.stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId').resolves([
        buildReview({
          submission_upload_review_id: 1,
          scope: SubmissionUploadReviewScope.VALIDATION,
          status: SubmissionUploadReviewStatus.COMPLETED
        }),
        buildReview({
          submission_upload_review_id: 2,
          scope: SubmissionUploadReviewScope.SECURITY,
          status: SubmissionUploadReviewStatus.SKIPPED
        })
      ]);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.hasUnresolvedRequiredReviews('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.equal(false);
    });

    it('returns true when any review is blocked', async () => {
      sinon.stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId').resolves([
        buildReview({
          submission_upload_review_id: 1,
          scope: SubmissionUploadReviewScope.VALIDATION,
          status: SubmissionUploadReviewStatus.COMPLETED
        }),
        buildReview({
          submission_upload_review_id: 2,
          scope: SubmissionUploadReviewScope.SECURITY,
          status: SubmissionUploadReviewStatus.BLOCKED
        })
      ]);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.hasUnresolvedRequiredReviews('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.equal(true);
    });
  });
});

const buildReview = (params: {
  submission_upload_review_id: number;
  scope: SubmissionUploadReviewScope;
  status?: SubmissionUploadReviewStatus;
}): SubmissionUploadReview => ({
  submission_upload_review_id: params.submission_upload_review_id,
  submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
  scope: params.scope,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7,
  create_date: '2026-05-05T00:00:00.000Z',
  create_user: 7,
  update_date: null,
  update_user: null,
  revision_count: 0,
  record_end_date: null
});
