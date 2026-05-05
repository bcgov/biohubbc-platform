import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400 } from '../../errors/http-error';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadReviewService } from './submission-upload-review-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('updateSubmissionUploadReviewStatus', () => {
    it('blocks approval when automated validation is not completed', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'started'
      });

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
          status: 'approved'
        });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload validation must be completed before approval');
      }
    });

    it('blocks approval when required scoped reviews are unresolved', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      sinon.stub(SubmissionUploadReviewService.prototype, 'hasUnresolvedRequiredReviews').resolves(true);

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
          status: 'approved'
        });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload has unresolved required reviews');
      }
    });

    it('updates approval when validation and required reviews are resolved', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      sinon.stub(SubmissionUploadReviewService.prototype, 'hasUnresolvedRequiredReviews').resolves(false);
      const updateStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'updateSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 1,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'approved'
        });

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'approved'
      });

      expect(result.status).to.equal('approved');
      expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        status: 'approved'
      });
    });

    it('updates denial without approval assertions', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const reviewGateStub = sinon.stub(SubmissionUploadReviewService.prototype, 'hasUnresolvedRequiredReviews');
      const updateStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'updateSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 1,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'denied'
        });

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'denied'
      });

      expect(result.status).to.equal('denied');
      expect(validationStub).not.to.have.been.called;
      expect(reviewGateStub).not.to.have.been.called;
      expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        status: 'denied'
      });
    });
  });
});
