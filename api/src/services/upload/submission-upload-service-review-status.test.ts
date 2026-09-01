import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400, HTTP409 } from '../../errors/http-error';
import { SubmissionFeatureRepository } from '../../repositories/submission-feature-repository';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { SubmissionUploadReconciliationService } from '../reconciliation/submission-upload-reconciliation-service';
import { SubmissionFeatureClosureService } from '../submission-feature-closure-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadService } from './submission-upload-service';

chai.use(sinonChai);

describe('SubmissionUploadService review decisions', () => {
  beforeEach(() => {
    sinon.stub(SubmissionUploadService.dependencies, 'publishComputeSubmissionFeatureClosureJob').resolves({
      status: 'published',
      jobId: 'closure-job'
    });
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves({
      submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
      submission_id: 1,
      upload_id: '550e8400-e29b-41d4-a716-446655440000',
      team_id: '990e8400-e29b-41d4-a716-446655440000',
      status: 'indexed',
      ticket_id: '550e8400-e29b-41d4-a716-446655440000',
      blueprint_id: 1
    });
    sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'getSubmissionUploadReviewStatus').resolves({
      submission_upload_status_id: 0,
      submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'submitted'
    });
    sinon
      .stub(SubmissionFeatureRepository.prototype, 'getActivatedSubmissionFeatureCountBySubmissionUploadId')
      .resolves(0);
    sinon.stub(SubmissionFeatureClosureService.prototype, 'invalidateClosureForSubmission').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('updateSubmissionUploadReviewStatus', () => {
    it('locks the upload before reading the current decision', async () => {
      const lockStub = SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub;
      const getStatusStub = SubmissionUploadReviewStatusRepository.prototype
        .getSubmissionUploadReviewStatus as sinon.SinonStub;
      sinon.stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus').resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'denied'
      });

      const service = new SubmissionUploadService(getMockDBConnection());
      await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'denied'
      });

      expect(lockStub).to.have.been.calledOnce;
      expect(lockStub).to.have.been.calledBefore(getStatusStub);
    });

    it('blocks approval when automated validation is not completed', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'started'
      });
      const reconcileStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );

      const service = new SubmissionUploadService(getMockDBConnection());

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

    it('records approval and activates an upload that is already indexed', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const reconcileStub = sinon
        .stub(SubmissionUploadReconciliationService.prototype, 'activateSubmissionUploadReconciliation')
        .resolves({ new: 1, modified: 3, unmodified: 2 });
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

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'approved'
      });

      expect(result.status).to.equal('approved');
      expect(reconcileStub).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(SubmissionFeatureClosureService.prototype.invalidateClosureForSubmission).to.have.been.calledOnceWith(1);
      expect(reconcileStub).to.have.been.calledBefore(
        SubmissionFeatureClosureService.prototype.invalidateClosureForSubmission as sinon.SinonStub
      );
      expect(SubmissionFeatureClosureService.prototype.invalidateClosureForSubmission).to.have.been.calledBefore(
        insertStatusStub
      );
      expect(updateUploadStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).to.have.been.calledOnce;
    });

    it('blocks approval before indexing is complete', async () => {
      const lockStub = SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub;
      lockStub.resolves({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        submission_id: 1,
        upload_id: '550e8400-e29b-41d4-a716-446655440000',
        team_id: '990e8400-e29b-41d4-a716-446655440000',
        status: 'reconciled',
        ticket_id: '550e8400-e29b-41d4-a716-446655440000',
        blueprint_id: 1
      });
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const activateStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const insertStatusStub = sinon.stub(
        SubmissionUploadReviewStatusRepository.prototype,
        'insertSubmissionUploadReviewStatus'
      );

      const service = new SubmissionUploadService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
          status: 'approved'
        });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload must be indexed before approval');
      }

      expect(activateStub).not.to.have.been.called;
      expect(insertStatusStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('blocks approval after a newer upload has superseded the upload', async () => {
      const lockStub = SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub;
      lockStub.resolves({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        submission_id: 1,
        upload_id: '550e8400-e29b-41d4-a716-446655440000',
        team_id: '990e8400-e29b-41d4-a716-446655440000',
        status: 'indexed',
        ticket_id: '550e8400-e29b-41d4-a716-446655440000',
        blueprint_id: 1,
        successor_submission_upload_id: '660e8400-e29b-41d4-a716-446655440000'
      });
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const activateStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const insertStatusStub = sinon.stub(
        SubmissionUploadReviewStatusRepository.prototype,
        'insertSubmissionUploadReviewStatus'
      );

      const service = new SubmissionUploadService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
          status: 'approved'
        });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload has been superseded by a newer upload');
      }

      expect(validationStub).not.to.have.been.called;
      expect(activateStub).not.to.have.been.called;
      expect(insertStatusStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('returns the existing review status when the upload is already approved', async () => {
      const getStatusStub = SubmissionUploadReviewStatusRepository.prototype
        .getSubmissionUploadReviewStatus as sinon.SinonStub;
      getStatusStub.resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
      const insertStatusStub = sinon.stub(
        SubmissionUploadReviewStatusRepository.prototype,
        'insertSubmissionUploadReviewStatus'
      );
      const activateStub = sinon
        .stub(SubmissionUploadReconciliationService.prototype, 'activateSubmissionUploadReconciliation')
        .resolves({ new: 0, modified: 0, unmodified: 1 });

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'approved'
      });

      expect(result).to.eql({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
      expect(insertStatusStub).not.to.have.been.called;
      expect(activateStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('records rejection without mutating reconciliation or feature state', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const reconcileStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
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

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'denied'
      });

      expect(result.status).to.equal('denied');
      expect(validationStub).not.to.have.been.called;
      expect(reconcileStub).not.to.have.been.called;
      expect(updateUploadStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'denied'
      });
    });

    it('blocks denial when an upload is already approved', async () => {
      const getStatusStub = SubmissionUploadReviewStatusRepository.prototype
        .getSubmissionUploadReviewStatus as sinon.SinonStub;
      getStatusStub.resolves({
        submission_upload_status_id: 1,
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'approved'
      });
      const approvalGuard = SubmissionFeatureRepository.prototype
        .getActivatedSubmissionFeatureCountBySubmissionUploadId as sinon.SinonStub;
      approvalGuard.resolves(1);
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 2,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'denied'
        });

      const service = new SubmissionUploadService(getMockDBConnection());
      try {
        await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
          status: 'denied'
        });
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }

      expect(approvalGuard).to.have.been.calledOnceWith('550e8400-e29b-41d4-a716-446655440000');
      expect(insertStatusStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('updates deleted without patching upload or feature rows', async () => {
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload');
      const reconcileStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 1,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'deleted'
        });

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'deleted'
      });

      expect(result.status).to.equal('deleted');
      expect(updateUploadStub).not.to.have.been.called;
      expect(reconcileStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'deleted'
      });
    });

    it('records submitted without mutating reconciliation or feature state', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const reconcileStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const updateUploadStub = sinon.stub(SubmissionUploadService.prototype, 'updateSubmissionUpload');
      const insertStatusStub = sinon
        .stub(SubmissionUploadReviewStatusRepository.prototype, 'insertSubmissionUploadReviewStatus')
        .resolves({
          submission_upload_status_id: 1,
          submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'submitted'
        });

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadReviewStatus('550e8400-e29b-41d4-a716-446655440000', {
        status: 'submitted'
      });

      expect(result.status).to.equal('submitted');
      expect(validationStub).not.to.have.been.called;
      expect(updateUploadStub).not.to.have.been.called;
      expect(reconcileStub).not.to.have.been.called;
      expect(insertStatusStub).to.have.been.calledOnceWith({
        submission_upload_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'submitted'
      });
    });
  });
});
