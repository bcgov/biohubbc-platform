import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { HTTP400, HTTP409 } from '../../errors/http-error';
import { SubmissionUpload } from '../../models/submission-upload';
import { SubmissionFeatureRepository } from '../../repositories/submission-feature-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { SubmissionUploadReconciliationService } from '../reconciliation/submission-upload-reconciliation-service';
import { SubmissionFeatureClosureService } from '../submission-feature-closure-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadService } from './submission-upload-service';

chai.use(sinonChai);

const SUBMISSION_UPLOAD_ID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Build a locked submission upload in the state that permits approval.
 *
 * @param {Partial<SubmissionUpload>} overrides Fields to override.
 * @returns {SubmissionUpload} Upload row.
 */
const buildUpload = (overrides: Partial<SubmissionUpload> = {}): SubmissionUpload => ({
  submission_upload_id: SUBMISSION_UPLOAD_ID,
  submission_id: 1,
  upload_id: '550e8400-e29b-41d4-a716-446655440000',
  team_id: '990e8400-e29b-41d4-a716-446655440000',
  status: 'indexed',
  decision: 'pending',
  ticket_id: '550e8400-e29b-41d4-a716-446655440000',
  blueprint_id: 1,
  ...overrides
});

describe('SubmissionUploadService decisions', () => {
  beforeEach(() => {
    sinon.stub(SubmissionUploadService.dependencies, 'publishComputeSubmissionFeatureClosureJob').resolves({
      status: 'published',
      jobId: 'closure-job'
    });
    sinon.stub(SubmissionUploadService.prototype, 'getSubmissionUploadWithLock').resolves(buildUpload());
    sinon
      .stub(SubmissionFeatureRepository.prototype, 'getActivatedSubmissionFeatureCountBySubmissionUploadId')
      .resolves(0);
    sinon.stub(SubmissionFeatureClosureService.prototype, 'invalidateClosureForSubmission').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('updateSubmissionUploadDecision', () => {
    it('locks the upload before writing the decision', async () => {
      const lockStub = SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub;
      const updateStub = sinon
        .stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision')
        .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'denied', revision_count: 2 });

      const service = new SubmissionUploadService(getMockDBConnection());
      await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'denied' });

      expect(lockStub).to.have.been.calledOnce;
      expect(lockStub).to.have.been.calledBefore(updateStub);
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
      const updateStub = sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision');

      const service = new SubmissionUploadService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'approved' });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload validation must be completed before approval');
      }

      expect(reconcileStub).not.to.have.been.called;
      expect(updateStub).not.to.have.been.called;
    });

    it('records approval, activates the indexed upload and queues the closure recompute keyed on the audit revision', async () => {
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const reconcileStub = sinon
        .stub(SubmissionUploadReconciliationService.prototype, 'activateSubmissionUploadReconciliation')
        .resolves({ new: 1, modified: 3, unmodified: 2 });
      const updateStub = sinon
        .stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision')
        .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'approved', revision_count: 5 });
      const invalidateStub = SubmissionFeatureClosureService.prototype
        .invalidateClosureForSubmission as sinon.SinonStub;

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'approved' });

      expect(result).to.eql({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'approved' });
      expect(reconcileStub).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID);
      expect(invalidateStub).to.have.been.calledOnceWith(1);
      expect(reconcileStub).to.have.been.calledBefore(invalidateStub);
      expect(invalidateStub).to.have.been.calledBefore(updateStub);
      expect(updateStub).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID, 'approved');
      expect(
        SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob
      ).to.have.been.calledOnceWith(
        sinon.match.any,
        { submissionUploadId: SUBMISSION_UPLOAD_ID },
        { singletonKey: `closure-recompute-${SUBMISSION_UPLOAD_ID}-5` }
      );
    });

    it('blocks approval before indexing is complete', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves(
        buildUpload({ status: 'reconciled' })
      );
      sinon.stub(SubmissionValidationService.prototype, 'getSubmissionValidationBySubmissionUploadId').resolves({
        submission_validation_id: 1,
        job_id: 'job-1',
        status: 'completed'
      });
      const activateStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const updateStub = sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision');

      const service = new SubmissionUploadService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'approved' });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload must be indexed before approval');
      }

      expect(activateStub).not.to.have.been.called;
      expect(updateStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('blocks approval after a newer upload has superseded the upload', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves(
        buildUpload({ successor_submission_upload_id: '660e8400-e29b-41d4-a716-446655440000' })
      );
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const activateStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const updateStub = sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision');

      const service = new SubmissionUploadService(getMockDBConnection());

      try {
        await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'approved' });
        expect.fail('Expected HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).message).to.equal('Submission upload has been superseded by a newer upload');
      }

      expect(validationStub).not.to.have.been.called;
      expect(activateStub).not.to.have.been.called;
      expect(updateStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('returns the existing decision without writing when the upload is already approved', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves(
        buildUpload({ decision: 'approved' })
      );
      const updateStub = sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision');
      const activateStub = sinon
        .stub(SubmissionUploadReconciliationService.prototype, 'activateSubmissionUploadReconciliation')
        .resolves({ new: 0, modified: 0, unmodified: 1 });

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'approved' });

      expect(result).to.eql({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'approved' });
      expect(updateStub).not.to.have.been.called;
      expect(activateStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('records a denial without mutating reconciliation or feature state', async () => {
      const validationStub = sinon.stub(
        SubmissionValidationService.prototype,
        'getSubmissionValidationBySubmissionUploadId'
      );
      const reconcileStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const updateStub = sinon
        .stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision')
        .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'denied', revision_count: 2 });

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'denied' });

      expect(result).to.eql({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'denied' });
      expect(validationStub).not.to.have.been.called;
      expect(reconcileStub).not.to.have.been.called;
      expect(updateStub).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID, 'denied');
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('blocks a denial once the upload has activated features', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves(
        buildUpload({ decision: 'approved' })
      );
      const approvalGuard = SubmissionFeatureRepository.prototype
        .getActivatedSubmissionFeatureCountBySubmissionUploadId as sinon.SinonStub;
      approvalGuard.resolves(1);
      const updateStub = sinon.stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision');

      const service = new SubmissionUploadService(getMockDBConnection());
      try {
        await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'denied' });
        expect.fail('Expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
      }

      expect(approvalGuard).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID);
      expect(updateStub).not.to.have.been.called;
      expect(SubmissionUploadService.dependencies.publishComputeSubmissionFeatureClosureJob).not.to.have.been.called;
    });

    it('records pending to clear a prior decision without mutating reconciliation or feature state', async () => {
      (SubmissionUploadService.prototype.getSubmissionUploadWithLock as sinon.SinonStub).resolves(
        buildUpload({ decision: 'denied' })
      );
      const reconcileStub = sinon.stub(
        SubmissionUploadReconciliationService.prototype,
        'activateSubmissionUploadReconciliation'
      );
      const updateStub = sinon
        .stub(SubmissionUploadRepository.prototype, 'updateSubmissionUploadDecision')
        .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'pending', revision_count: 3 });

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.updateSubmissionUploadDecision(SUBMISSION_UPLOAD_ID, { decision: 'pending' });

      expect(result).to.eql({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'pending' });
      expect(reconcileStub).not.to.have.been.called;
      expect(updateStub).to.have.been.calledOnceWith(SUBMISSION_UPLOAD_ID, 'pending');
    });
  });

  describe('findSubmissionDecisionHistoryByUuid', () => {
    it('maps every upload to the stable wire status, reporting soft-deleted uploads as deleted', async () => {
      sinon.stub(SubmissionUploadRepository.prototype, 'findSubmissionUploadDecisionHistoryBySubmissionUuid').resolves([
        {
          submission_id: 7,
          submission_upload_id: 'upload-3',
          decision: 'pending',
          record_end_date: '2026-09-03T02:00:00.000Z',
          create_date: '2026-09-03T01:00:00.000Z'
        },
        {
          submission_id: 7,
          submission_upload_id: 'upload-2',
          decision: 'pending',
          record_end_date: null,
          create_date: '2026-09-03T00:30:00.000Z'
        },
        {
          submission_id: 7,
          submission_upload_id: 'upload-1',
          decision: 'approved',
          record_end_date: null,
          create_date: '2026-09-03T00:00:00.000Z'
        }
      ]);

      const service = new SubmissionUploadService(getMockDBConnection());
      const result = await service.findSubmissionDecisionHistoryByUuid('submission-uuid');

      expect(result).to.eql({
        submissionId: 7,
        history: [
          { submissionUploadId: 'upload-3', status: 'deleted', createDate: '2026-09-03T01:00:00.000Z' },
          { submissionUploadId: 'upload-2', status: 'submitted', createDate: '2026-09-03T00:30:00.000Z' },
          { submissionUploadId: 'upload-1', status: 'approved', createDate: '2026-09-03T00:00:00.000Z' }
        ]
      });
    });

    it('resolves the submission id through the submission service when it has no uploads', async () => {
      sinon
        .stub(SubmissionUploadRepository.prototype, 'findSubmissionUploadDecisionHistoryBySubmissionUuid')
        .resolves([]);
      const service = new SubmissionUploadService(getMockDBConnection());
      const submissionStub = sinon
        .stub(service.submissionService, 'getSubmissionIdByUUID')
        .resolves({ submission_id: 9 });

      const result = await service.findSubmissionDecisionHistoryByUuid('submission-uuid');

      expect(submissionStub).to.have.been.calledOnceWith('submission-uuid');
      expect(result).to.eql({ submissionId: 9, history: [] });
    });
  });
});
