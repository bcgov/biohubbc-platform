import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400 } from '../../errors/http-error';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionFeatureService } from '../submission-feature-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';
import { SubmissionUploadService } from './submission-upload-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('updateSubmissionUploadReviewStatus', () => {
    it('blocks approval when automated validation is not completed', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'submitted'
      });
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

    it('updates approval when validation is completed', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'submitted'
      });
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const publishFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'setRecordEffectiveDateBySubmissionUploadId')
        .resolves();
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload').resolves({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000'
      });
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
      expect(publishFeaturesStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(updateUploadStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        status: 'indexed'
      });
      expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        status: 'approved'
      });
    });

    it('updates denial without approval assertions', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'submitted'
      });
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const publishFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'setRecordEffectiveDateBySubmissionUploadId'
      );
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload');
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
      expect(publishFeaturesStub).not.to.have.been.called;
      expect(updateUploadStub).not.to.have.been.called;
      expect(updateStatusStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000', {
        status: 'denied'
      });
    });

    it('blocks final decision updates after the upload is already finalized', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
      const updateStatusStub = sinon.stub(
        SubmissionUploadReviewStatusRepository.prototype,
        'updateSubmissionUploadReviewStatus'
      );

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
          status: 'denied'
        });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload final decision has already been set');
      }

      expect(updateStatusStub).not.to.have.been.called;
    });
  });
});
