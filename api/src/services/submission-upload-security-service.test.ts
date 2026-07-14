import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SecurityRepository } from '../repositories/security-repository';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { SecurityRuleService } from './security-rule-service';
import { SubmissionUploadSecurityService } from './submission-upload-security-service';

chai.use(sinonChai);

const makeRule = (overrides = {}) => ({
  security_rule_id: 1,
  policy_id: null,
  name: 'Victoria Rule',
  description: 'City of Victoria geometry rule',
  is_active: true,
  record_effective_date: '2024-01-01',
  record_end_date: null,
  create_date: '2024-01-01',
  create_user: 1,
  update_date: null,
  update_user: null,
  revision_count: 0,
  ...overrides
});

describe('SubmissionUploadSecurityService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('evaluateTriggerFeatureIds (stub)', () => {
    it('returns an empty array for any rule and upload (stub — policy evaluator not yet implemented)', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const result = await service.evaluateTriggerFeatureIds(makeRule() as any, 'upload-uuid-1');

      expect(result).to.deep.equal([]);
    });
  });

  describe('screenSubmissionUpload', () => {
    it('records a started scan event, evaluates rules, inserts drafts, and completes the scan event', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const insertScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent')
        .resolves(99);
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus')
        .resolves();
      const getRulesStub = sinon
        .stub(SecurityRuleService.prototype, 'getScreenableSecurityRules')
        .resolves([makeRule() as any]);
      const evaluateStub = sinon.stub(service, 'evaluateTriggerFeatureIds').resolves([10, 20]);
      const insertStub = sinon.stub(SecurityRepository.prototype, 'insertDraftSecurityForTriggers').resolves(3);

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertScanEventStub).to.have.been.calledOnceWith('upload-uuid-1', 'job-uuid-1');
      expect(getRulesStub).to.have.been.calledOnce;
      expect(evaluateStub).to.have.been.calledOnceWith(makeRule(), 'upload-uuid-1');
      // Draft insert is linked to the scan event id returned by insertScanEvent.
      expect(insertStub).to.have.been.calledOnceWith([10, 20], 1, 'upload-uuid-1', 99);
      expect(updateScanEventStub).to.have.been.calledOnceWith(99, 'completed', { ruleCount: 1, insertedCount: 3 });
    });

    it('skips insert when evaluateTriggerFeatureIds returns empty for a rule', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      sinon.stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent').resolves(99);
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus')
        .resolves();
      sinon.stub(SecurityRuleService.prototype, 'getScreenableSecurityRules').resolves([makeRule() as any]);
      sinon.stub(service, 'evaluateTriggerFeatureIds').resolves([]);
      const insertStub = sinon.stub(SecurityRepository.prototype, 'insertDraftSecurityForTriggers');

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertStub).to.not.have.been.called;
      expect(updateScanEventStub).to.have.been.calledOnceWith(99, 'completed', { ruleCount: 1, insertedCount: 0 });
    });

    it('processes multiple rules independently and accumulates the inserted count', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const rule1 = makeRule({ security_rule_id: 1, name: 'Rule A' });
      const rule2 = makeRule({ security_rule_id: 2, name: 'Rule B' });

      sinon.stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent').resolves(99);
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus')
        .resolves();
      sinon.stub(SecurityRuleService.prototype, 'getScreenableSecurityRules').resolves([rule1, rule2] as any);
      const evaluateStub = sinon
        .stub(service, 'evaluateTriggerFeatureIds')
        .onFirstCall()
        .resolves([5])
        .onSecondCall()
        .resolves([]);
      const insertStub = sinon.stub(SecurityRepository.prototype, 'insertDraftSecurityForTriggers').resolves(1);

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(evaluateStub).to.have.been.calledTwice;
      // Rule A had triggers -> insert called once; Rule B had no triggers -> no insert
      expect(insertStub).to.have.been.calledOnceWith([5], 1, 'upload-uuid-1', 99);
      expect(updateScanEventStub).to.have.been.calledOnceWith(99, 'completed', { ruleCount: 2, insertedCount: 1 });
    });

    it('completes the scan event with a zero count when no screenable rules exist', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      sinon.stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent').resolves(99);
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus')
        .resolves();
      sinon.stub(SecurityRuleService.prototype, 'getScreenableSecurityRules').resolves([]);
      const insertStub = sinon.stub(SecurityRepository.prototype, 'insertDraftSecurityForTriggers');

      await service.screenSubmissionUpload('upload-uuid-1', 1, 'job-uuid-1');

      expect(insertStub).to.not.have.been.called;
      expect(updateScanEventStub).to.have.been.calledOnceWith(99, 'completed', { ruleCount: 0, insertedCount: 0 });
    });
  });

  describe('recordScreeningFailure', () => {
    it('inserts a scan event and marks it failed', async () => {
      const conn = getMockDBConnection();
      const service = new SubmissionUploadSecurityService(conn);

      const insertScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent')
        .resolves(77);
      const updateScanEventStub = sinon
        .stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus')
        .resolves();

      await service.recordScreeningFailure('upload-uuid-1', 'job-uuid-1');

      expect(insertScanEventStub).to.have.been.calledOnceWith('upload-uuid-1', 'job-uuid-1');
      expect(updateScanEventStub).to.have.been.calledOnceWith(77, 'failed');
    });
  });
});
