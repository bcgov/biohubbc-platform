import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400 } from '../../errors/http-error';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionFeatureReconciliationService } from '../reconciliation/submission-feature-reconciliation-service';
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
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'started'
      });
      const reconcileStub = sinon.stub(
        SubmissionFeatureReconciliationService.prototype,
        'reconcileAndActivateSubmissionUpload'
      );

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

      expect(reconcileStub).not.to.have.been.called;
    });

    it('reconciles and activates the upload when approval validation is completed', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const reconcileStub = sinon
        .stub(SubmissionFeatureReconciliationService.prototype, 'reconcileAndActivateSubmissionUpload')
        .resolves({ new: 1, unchanged: 2, superseded: 3, conflict: 0 });
      const unpublishFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'unpublishLiveSubmissionFeaturesBySubmissionUploadId'
      );
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
      expect(result.reconciliation).to.eql({ new: 1, unchanged: 2, superseded: 3, conflict: 0 });
      expect(reconcileStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(unpublishFeaturesStub).not.to.have.been.called;
      expect(updateUploadStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
    });

    it('updates rejection by un-publishing live rows without approval assertions', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const reconcileStub = sinon.stub(
        SubmissionFeatureReconciliationService.prototype,
        'reconcileAndActivateSubmissionUpload'
      );
      const unpublishFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'unpublishLiveSubmissionFeaturesBySubmissionUploadId')
        .resolves(3);
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
      expect(result.reconciliation).to.be.undefined;
      expect(validationStub).not.to.have.been.called;
      expect(reconcileStub).not.to.have.been.called;
      expect(unpublishFeaturesStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(updateUploadStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'denied'
      });
    });

    it('updates deleted without patching upload or feature rows', async () => {
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload');
      const reconcileStub = sinon.stub(
        SubmissionFeatureReconciliationService.prototype,
        'reconcileAndActivateSubmissionUpload'
      );
      const unpublishFeaturesStub = sinon.stub(
        SubmissionFeatureService.prototype,
        'unpublishLiveSubmissionFeaturesBySubmissionUploadId'
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
      expect(reconcileStub).not.to.have.been.called;
      expect(unpublishFeaturesStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'deleted'
      });
    });

    it('updates submitted by un-publishing live rows without resurrecting ended rows', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const reconcileStub = sinon.stub(
        SubmissionFeatureReconciliationService.prototype,
        'reconcileAndActivateSubmissionUpload'
      );
      const unpublishFeaturesStub = sinon
        .stub(SubmissionFeatureService.prototype, 'unpublishLiveSubmissionFeaturesBySubmissionUploadId')
        .resolves(0);
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
      expect(reconcileStub).not.to.have.been.called;
      expect(unpublishFeaturesStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'submitted'
      });
    });
  });
});
