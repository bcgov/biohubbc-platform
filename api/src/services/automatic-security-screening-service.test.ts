import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { AutomaticSecurityScreeningRepository } from '../repositories/automatic-security-screening-repository';
import { SecurityRuleRepository } from '../repositories/security-rule-repository';
import { AutomaticSecurityScreeningService } from './automatic-security-screening-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

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

describe('AutomaticSecurityScreeningService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('evaluateTriggerFeatureIds (stub)', () => {
    it('returns an empty array for any rule and upload (stub — policy evaluator not yet implemented)', async () => {
      const conn = getMockDBConnection();
      const service = new AutomaticSecurityScreeningService(conn);

      const result = await service.evaluateTriggerFeatureIds(makeRule() as any, 'upload-uuid-1');

      expect(result).to.deep.equal([]);
    });
  });

  describe('screenSubmissionUpload', () => {
    it('transitions to security_screening, evaluates rules, and transitions to security_screened', async () => {
      const conn = getMockDBConnection();
      const service = new AutomaticSecurityScreeningService(conn);

      const toScreeningStub = sinon
        .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreening')
        .resolves();
      const toScreenedStub = sinon
        .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreened')
        .resolves();
      const getRulesStub = sinon
        .stub(SecurityRuleRepository.prototype, 'getScreenableSecurityRules')
        .resolves([makeRule() as any]);
      const evaluateStub = sinon.stub(service, 'evaluateTriggerFeatureIds').resolves([10, 20]);
      const insertStub = sinon
        .stub(AutomaticSecurityScreeningRepository.prototype, 'insertDraftSecurityForTriggers')
        .resolves(3);

      await service.screenSubmissionUpload('upload-uuid-1', 1);

      expect(toScreeningStub).to.have.been.calledOnceWith('upload-uuid-1');
      expect(getRulesStub).to.have.been.calledOnce;
      expect(evaluateStub).to.have.been.calledOnceWith(makeRule(), 'upload-uuid-1');
      expect(insertStub).to.have.been.calledOnceWith([10, 20], 1, 'upload-uuid-1');
      expect(toScreenedStub).to.have.been.calledOnceWith('upload-uuid-1');
    });

    it('skips insert when evaluateTriggerFeatureIds returns empty for a rule (AC3)', async () => {
      const conn = getMockDBConnection();
      const service = new AutomaticSecurityScreeningService(conn);

      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreening').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreened').resolves();
      sinon.stub(SecurityRuleRepository.prototype, 'getScreenableSecurityRules').resolves([makeRule() as any]);
      sinon.stub(service, 'evaluateTriggerFeatureIds').resolves([]);
      const insertStub = sinon.stub(AutomaticSecurityScreeningRepository.prototype, 'insertDraftSecurityForTriggers');

      await service.screenSubmissionUpload('upload-uuid-1', 1);

      expect(insertStub).to.not.have.been.called;
    });

    it('processes multiple rules independently (AC3)', async () => {
      const conn = getMockDBConnection();
      const service = new AutomaticSecurityScreeningService(conn);

      const rule1 = makeRule({ security_rule_id: 1, name: 'Rule A' });
      const rule2 = makeRule({ security_rule_id: 2, name: 'Rule B' });

      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreening').resolves();
      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreened').resolves();
      sinon.stub(SecurityRuleRepository.prototype, 'getScreenableSecurityRules').resolves([rule1, rule2] as any);
      const evaluateStub = sinon
        .stub(service, 'evaluateTriggerFeatureIds')
        .onFirstCall()
        .resolves([5])
        .onSecondCall()
        .resolves([]);
      const insertStub = sinon
        .stub(AutomaticSecurityScreeningRepository.prototype, 'insertDraftSecurityForTriggers')
        .resolves(1);

      await service.screenSubmissionUpload('upload-uuid-1', 1);

      expect(evaluateStub).to.have.been.calledTwice;
      // Rule A had triggers -> insert called once; Rule B had no triggers -> no insert
      expect(insertStub).to.have.been.calledOnce;
      expect(insertStub).to.have.been.calledWith([5], 1, 'upload-uuid-1');
    });

    it('does nothing with rules when no screenable rules exist (AC3)', async () => {
      const conn = getMockDBConnection();
      const service = new AutomaticSecurityScreeningService(conn);

      sinon.stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreening').resolves();
      const toScreenedStub = sinon
        .stub(SubmissionUploadService.prototype, 'transitionSubmissionUploadToSecurityScreened')
        .resolves();
      sinon.stub(SecurityRuleRepository.prototype, 'getScreenableSecurityRules').resolves([]);
      const insertStub = sinon.stub(AutomaticSecurityScreeningRepository.prototype, 'insertDraftSecurityForTriggers');

      await service.screenSubmissionUpload('upload-uuid-1', 1);

      expect(insertStub).to.not.have.been.called;
      expect(toScreenedStub).to.have.been.calledOnce;
    });
  });
});
