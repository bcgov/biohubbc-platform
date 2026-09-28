import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { SecurityRuleService } from './security-rule-service';
import { SubmissionUploadSecurityService } from './submission-upload-security-service';

chai.use(sinonChai);

describe('SubmissionUploadSecurityService', () => {
  afterEach(() => sinon.restore());

  it('creates and completes a screening event without fetching rules', async () => {
    const service = new SubmissionUploadSecurityService(getMockDBConnection());
    const insertEvent = sinon.stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent').resolves(99);
    const completeEvent = sinon.stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus').resolves();
    const getRules = sinon
      .stub(SecurityRuleService.prototype, 'getScreenableSecurityRules')
      .rejects(new Error('Rule fetching is deferred'));
    await service.screenSubmissionUpload('upload-1', 1, 'job-1');
    expect(insertEvent).to.have.been.calledOnceWith('upload-1', 'job-1');
    expect(completeEvent).to.have.been.calledOnceWith(99, 'completed', { ruleCount: 0, insertedCount: 0 });
    expect(getRules).not.to.have.been.called;
    sinon.assert.callOrder(insertEvent, completeEvent);
  });

  it('records an exhausted screening attempt as a failed event', async () => {
    const service = new SubmissionUploadSecurityService(getMockDBConnection());
    const insertEvent = sinon.stub(SubmissionUploadSecurityRepository.prototype, 'insertScanEvent').resolves(99);
    const completeEvent = sinon.stub(SubmissionUploadSecurityRepository.prototype, 'updateScanEventStatus').resolves();
    await service.recordScreeningFailure('upload-1', 'job-1');
    expect(insertEvent).to.have.been.calledOnceWith('upload-1', 'job-1');
    expect(completeEvent).to.have.been.calledOnceWith(99, 'failed');
  });
});
