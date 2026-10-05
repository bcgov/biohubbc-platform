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
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { SubmissionUploadReviewRepository } from '../../repositories/upload/submission-upload-review-repository';
import { SubmissionUploadReviewService } from './submission-upload-review-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findReviewsBySubmissionUploadId', () => {
    it('validates the upload belongs to the submission before finding reviews', async () => {
      const review = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const getUploadStub = sinon
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadBySubmissionId')
        .resolves({
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          submission_id: 99,
          upload_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          status: 'uploaded',
          ticket_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        });
      const findStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId')
        .resolves([review]);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.findReviewsBySubmissionUploadId(17, '550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.eql([review]);
      expect(getUploadStub).to.have.been.calledOnceWith(17, '550e8400-e29b-41d4-a716-446655440000');
      expect(findStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('throws when the upload does not belong to the submission', async () => {
      sinon
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadBySubmissionId')
        .rejects(new ApiNotFoundError('Submission upload not found'));
      const findStub = sinon.stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId');

      const service = new SubmissionUploadReviewService(getMockDBConnection());

      try {
        await service.findReviewsBySubmissionUploadId(17, '550e8400-e29b-41d4-a716-446655440000');

        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(findStub).not.to.have.been.called;
    });
  });

  describe('insertSubmissionUploadReview', () => {
    it('inserts a new scoped review without changing existing reviews', async () => {
      const review = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const insertStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'insertSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.insertSubmissionUploadReview(17, {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Access rules',
        description: 'Review access rules',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.REQUESTED,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(insertStub).to.have.been.calledOnceWith(17, {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Access rules',
        description: 'Review access rules',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.REQUESTED,
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
      const result = await service.updateSubmissionUploadReview(
        17,
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-4111-8111-111111111111',
        { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      );

      expect(result).to.eql(review);
      expect(updateStub).to.have.been.calledOnceWith(
        17,
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-4111-8111-111111111111',
        { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      );
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
      const result = await service.deleteSubmissionUploadReview(
        17,
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-4111-8111-111111111111'
      );

      expect(result).to.eql(review);
      expect(deleteStub).to.have.been.calledOnceWith(
        17,
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-4111-8111-111111111111'
      );
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
  name: 'Access rules',
  description: 'Review access rules',
  scope: params.scope,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
