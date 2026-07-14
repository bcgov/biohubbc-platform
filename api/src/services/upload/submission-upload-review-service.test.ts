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
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadBySubmissionUuid')
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
      const result = await service.findReviewsBySubmissionUploadId(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result).to.eql([review]);
      expect(getUploadStub).to.have.been.calledOnceWith(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '550e8400-e29b-41d4-a716-446655440000'
      );
      expect(findStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('throws when the upload does not belong to the submission', async () => {
      sinon
        .stub(SubmissionUploadRepository.prototype, 'getSubmissionUploadBySubmissionUuid')
        .rejects(new ApiNotFoundError('Submission upload not found'));
      const findStub = sinon.stub(SubmissionUploadReviewRepository.prototype, 'findReviewsBySubmissionUploadId');

      const service = new SubmissionUploadReviewService(getMockDBConnection());

      try {
        await service.findReviewsBySubmissionUploadId(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '550e8400-e29b-41d4-a716-446655440000'
        );

        expect.fail('Expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(findStub).not.to.have.been.called;
    });
  });

  describe('insertSubmissionUploadReview', () => {
    it('soft deletes the active scoped review before inserting the replacement row', async () => {
      const review = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const softDeleteStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'softDeleteActiveSubmissionUploadReviewsByScope')
        .resolves(1);
      const insertStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'insertSubmissionUploadReview')
        .resolves(review);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.insertSubmissionUploadReview('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.REQUESTED,
        requested_by: 7
      });

      expect(result).to.eql(review);
      expect(softDeleteStub).to.have.been.calledOnceWith(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '550e8400-e29b-41d4-a716-446655440000',
        SubmissionUploadReviewScope.SECURITY
      );
      expect(insertStub).to.have.been.calledOnceWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.REQUESTED,
        requested_by: 7
      });
    });
  });

  describe('createDefaultReviewsForUpload', () => {
    it('creates pending validation and security reviews for an upload', async () => {
      const validationReview = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.VALIDATION,
        status: SubmissionUploadReviewStatus.PENDING
      });
      const securityReview = buildReview({
        submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.PENDING
      });
      const insertDefaultSubmissionUploadReviewsStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'insertDefaultSubmissionUploadReviews')
        .resolves([validationReview, securityReview]);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.createDefaultReviewsForUpload(99, '550e8400-e29b-41d4-a716-446655440000', 7);

      expect(result).to.eql([validationReview, securityReview]);
      expect(insertDefaultSubmissionUploadReviewsStub).to.have.been.calledOnceWith(
        99,
        '550e8400-e29b-41d4-a716-446655440000',
        7
      );
    });
  });

  describe('requestDefaultReviewsForUpload', () => {
    it('marks validation and security reviews requested for an upload', async () => {
      const validationReview = buildReview({
        submission_upload_review_id: '11111111-1111-4111-8111-111111111111',
        scope: SubmissionUploadReviewScope.VALIDATION
      });
      const securityReview = buildReview({
        submission_upload_review_id: '22222222-2222-4222-8222-222222222222',
        scope: SubmissionUploadReviewScope.SECURITY
      });
      const requestDefaultSubmissionUploadReviewsStub = sinon
        .stub(SubmissionUploadReviewRepository.prototype, 'requestDefaultSubmissionUploadReviews')
        .resolves([validationReview, securityReview]);

      const service = new SubmissionUploadReviewService(getMockDBConnection());
      const result = await service.requestDefaultReviewsForUpload(99, '550e8400-e29b-41d4-a716-446655440000', 7);

      expect(result).to.eql([validationReview, securityReview]);
      expect(requestDefaultSubmissionUploadReviewsStub).to.have.been.calledOnceWith(
        99,
        '550e8400-e29b-41d4-a716-446655440000',
        7
      );
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
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-4111-8111-111111111111',
        { status: SubmissionUploadReviewStatus.IN_PROGRESS }
      );

      expect(result).to.eql(review);
      expect(updateStub).to.have.been.calledOnceWith(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-4111-8111-111111111111'
      );

      expect(result).to.eql(review);
      expect(deleteStub).to.have.been.calledOnceWith(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
  scope: params.scope,
  status: params.status ?? SubmissionUploadReviewStatus.REQUESTED,
  requested_by: 7
});
