import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400 } from '../../errors/http-error';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionFeatureService } from '../submission-feature-service';
import { SubmissionService } from '../submission-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadReviewStatusService } from './submission-upload-review-status-service';
import { SubmissionUploadService } from './submission-upload-service';

chai.use(sinonChai);

describe('SubmissionUploadReviewStatusService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getSubmissionHistoryByUuid', () => {
    it('returns status history for the submission UUID', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getStatusHistoryBySubmissionUuid').resolves([
        {
          submission_id: 42,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'approved',
          create_date: new Date('2026-01-01T00:00:00.000Z')
        }
      ]);
      const getSubmissionStub = sinon.stub(SubmissionService.prototype, 'getSubmissionIdByUUID');
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      const result = await service.getSubmissionHistoryByUuid('11111111-1111-1111-1111-111111111111');

      expect(result).to.deep.equal({
        submissionId: 42,
        history: [
          {
            submissionUploadId: '550e8400-e29b-41d4-a716-446655440000',
            status: 'approved',
            createDate: '2026-01-01T00:00:00.000Z'
          }
        ]
      });
      expect(getSubmissionStub).not.to.have.been.called;
    });

    it('verifies the submission exists when it has no status history', async () => {
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getStatusHistoryBySubmissionUuid').resolves([]);
      const getSubmissionStub = sinon
        .stub(SubmissionService.prototype, 'getSubmissionIdByUUID')
        .resolves({ submission_id: 42 });
      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());

      const result = await service.getSubmissionHistoryByUuid('11111111-1111-1111-1111-111111111111');

      expect(result).to.deep.equal({ submissionId: 42, history: [] });
      expect(getSubmissionStub).to.have.been.calledOnceWith('11111111-1111-1111-1111-111111111111');
    });
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

    it('updates approval when validation is completed', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const publishFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'activateSubmissionFeaturesForSubmissionUploadId')
        .resolves();
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload').resolves({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000'
      });
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
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
      expect(updateUploadStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
    });

    it('updates rejection without approval assertions', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const acceptFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'activateSubmissionFeaturesForSubmissionUploadId'
      );
      const rejectFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'deactivateSubmissionFeaturesForSubmissionUploadId')
        .resolves();
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload').resolves({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000'
      });
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
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
      expect(acceptFeaturesStub).not.to.have.been.called;
      expect(rejectFeaturesStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(updateUploadStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'denied'
      });
    });

    it('updates deleted without patching upload or feature rows', async () => {
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload');
      const acceptFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'activateSubmissionFeaturesForSubmissionUploadId'
      );
      const rejectFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'deactivateSubmissionFeaturesForSubmissionUploadId'
      );
      const resetFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'resetSubmissionFeaturesToPendingForSubmissionUploadId'
      );
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 1,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'deleted'
        });

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'deleted'
      });

      expect(result.status).to.equal('deleted');
      expect(updateUploadStub).not.to.have.been.called;
      expect(acceptFeaturesStub).not.to.have.been.called;
      expect(rejectFeaturesStub).not.to.have.been.called;
      expect(resetFeaturesStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'deleted'
      });
    });

    it('updates submitted by clearing feature record dates', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const acceptFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'activateSubmissionFeaturesForSubmissionUploadId'
      );
      const rejectFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'deactivateSubmissionFeaturesForSubmissionUploadId'
      );
      const resetFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'resetSubmissionFeaturesToPendingForSubmissionUploadId')
        .resolves();
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload');
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 1,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'submitted'
        });

      const service = new SubmissionUploadReviewStatusService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'submitted'
      });

      expect(result.status).to.equal('submitted');
      expect(validationStub).not.to.have.been.called;
      expect(updateUploadStub).not.to.have.been.called;
      expect(acceptFeaturesStub).not.to.have.been.called;
      expect(rejectFeaturesStub).not.to.have.been.called;
      expect(resetFeaturesStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'submitted'
      });
    });
  });
});
