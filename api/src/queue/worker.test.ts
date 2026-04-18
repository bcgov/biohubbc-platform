import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { UPLOAD_JOB_BATCH_SIZE } from '../constants/upload';
import { JobQueues } from './jobs';
import * as computeScopeAnchorsJob from './jobs/compute-scope-anchors-job';
import * as indexSubmissionFeaturesJob from './jobs/index-submission-features-job';
import * as malwareScanJob from './jobs/malware-scan-job';
import * as processSubmissionFeaturesJob from './jobs/process-submission-features-job';
import * as pgBossService from './pg-boss-service';
import { registerWorkers } from './worker';

describe('worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('registerWorkers', () => {
    it('creates queues and registers handlers', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      expect(createQueueStub.calledWith(JobQueues.PROCESS_SUBMISSION_FEATURES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.MALWARE_SCAN)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.PROCESS_DOWNLOAD)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.INDEX_SUBMISSION_FEATURES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.COMPUTE_SCOPE_ANCHORS)).to.be.true;

      expect(
        workStub.calledWith(
          JobQueues.PROCESS_SUBMISSION_FEATURES,
          { batchSize: UPLOAD_JOB_BATCH_SIZE },
          processSubmissionFeaturesJob.processSubmissionFeaturesJobHandler
        )
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
          processSubmissionFeaturesJob.processSubmissionFeaturesFailedHandler
        )
      ).to.be.true;
      expect(workStub.calledWith(JobQueues.MALWARE_SCAN, malwareScanJob.malwareScanJobHandler)).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.INDEX_SUBMISSION_FEATURES,
          indexSubmissionFeaturesJob.indexSubmissionFeaturesJobHandler
        )
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.INDEX_SUBMISSION_FEATURES_FAILED,
          indexSubmissionFeaturesJob.indexSubmissionFeaturesFailedHandler
        )
      ).to.be.true;
      expect(workStub.calledWith(JobQueues.COMPUTE_SCOPE_ANCHORS, computeScopeAnchorsJob.computeScopeAnchorsJobHandler))
        .to.be.true;
    });

    it('configures dead letter queue for process-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const processQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(processQueueCall).to.not.be.undefined;

      const queueConfig = processQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(queueConfig.retryLimit).to.equal(2);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });

    it('configures dead letter queue for index-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const indexQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(indexQueueCall).to.not.be.undefined;

      const queueConfig = indexQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
    });
  });
});
