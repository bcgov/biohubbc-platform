import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../models/submission-upload-review';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { SecurityRuleService } from './security-rule-service';
import { SubmissionUploadSecurityService } from './submission-upload-security-service';
import { SubmissionUploadReviewService } from './upload/submission-upload-review-service';

chai.use(sinonChai);

describe('SubmissionUploadSecurityService', () => {
  let insertReview: sinon.SinonStub;
  let completeReview: sinon.SinonStub;
  beforeEach(() => {
    insertReview = sinon
      .stub(SubmissionUploadReviewService.prototype, 'insertSubmissionUploadReview')
      .resolves({ submission_upload_review_id: 'review-1' } as any);
    completeReview = sinon.stub(SubmissionUploadReviewService.prototype, 'updateSubmissionUploadReview').resolves();
  });
  afterEach(() => {
    sinon.restore();
  });

  describe('screenSubmissionUpload', () => {
    it('creates and completes a linked review and event without fetching rules', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const insertSubmissionUploadSecurityStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 99 });
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateSubmissionUploadSecurityStatus')
        .resolves();
      const getRulesStub = sinon
        .stub(SecurityRuleService.prototype, 'getScreenableSecurityRules')
        .rejects(new Error('Screening must not fetch rules'));

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertSubmissionUploadSecurityStub).to.have.been.calledOnceWith('upload-uuid-1', 'job-uuid-1', 'review-1');
      expect(insertReview).to.have.been.calledOnceWith(1, {
        submission_upload_id: 'upload-uuid-1',
        name: 'Automatic security screening',
        description: null,
        scope: SubmissionUploadReviewScope.SECURITY,
        status: SubmissionUploadReviewStatus.PENDING,
        requested_by: conn.systemUserId()
      });
      expect(completeReview).to.have.been.calledOnceWith(1, 'upload-uuid-1', 'review-1', {
        status: SubmissionUploadReviewStatus.COMPLETED
      });
      sinon.assert.callOrder(insertReview, insertSubmissionUploadSecurityStub, completeReview, updateScanEventStub);
      expect(getRulesStub).not.to.have.been.called;
      expect(updateScanEventStub).to.have.been.calledOnceWith(99, 'completed', { ruleCount: 0, insertedCount: 0 });
    });

    it('propagates completion failures to the transactional job handler', async () => {
      const service = new SubmissionUploadSecurityService(getMockDBConnection());
      sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 99 });
      const completeEvent = sinon.stub(
        SubmissionUploadSecurityRepository.prototype,
        'updateSubmissionUploadSecurityStatus'
      );
      const failure = new Error('Review completion failed');
      completeReview.rejects(failure);
      let caught: unknown;
      try {
        await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');
      } catch (error_) {
        caught = error_;
      }
      expect(caught).to.equal(failure);
      expect(completeEvent).not.to.have.been.called;
    });
  });

  describe('recordSubmissionUploadSecurityFailure', () => {
    it('inserts a scan event and marks it failed', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const insertSubmissionUploadSecurityStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertSubmissionUploadSecurity')
        .resolves({ submission_upload_security_id: 77 });
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateSubmissionUploadSecurityStatus')
        .resolves();

      await service.recordSubmissionUploadSecurityFailure('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertSubmissionUploadSecurityStub).to.have.been.calledOnceWith('upload-uuid-1', 'job-uuid-1', 'review-1');
      expect(insertReview.firstCall.args[1].status).to.equal(SubmissionUploadReviewStatus.BLOCKED);
      expect(completeReview).not.to.have.been.called;
      expect(updateScanEventStub).to.have.been.calledOnceWith(77, 'failed');
    });
  });
});
