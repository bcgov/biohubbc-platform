import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { JobQueues } from './jobs';
import * as malwareScanJob from './jobs/malware-scan-job';
import * as processSubmissionFeaturesJob from './jobs/process-submission-features-job';
import * as testJob from './jobs/test-job';
import * as pgBossService from './pg-boss-service';
import { registerWorkers } from './worker';

describe('worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('registerWorkers', () => {
    it('registers the test job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // First call is for TEST queue
      expect(workStub.firstCall.args[0]).to.equal(JobQueues.TEST);
      expect(workStub.firstCall.args[2]).to.equal(testJob.testJobHandler);
    });

    it('registers the process submission features job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Second call is for PROCESS_SUBMISSION_FEATURES queue
      expect(workStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(workStub.secondCall.args[2]).to.equal(processSubmissionFeaturesJob.processSubmissionFeaturesJobHandler);
    });

    it('registers the malware scan job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Third call is for MALWARE_SCAN queue
      expect(workStub.thirdCall.args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(workStub.thirdCall.args[2]).to.equal(malwareScanJob.malwareScanJobHandler);
    });

    it('creates queues before registering workers (pg-boss v10 requirement)', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // createQueue is called for all queues (including dead letter queue)
      expect(createQueueStub.callCount).to.equal(4);
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.TEST);
      expect(createQueueStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.thirdCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(createQueueStub.getCall(4).args[0]).to.equal(JobQueues.MALWARE_SCAN);
    });

    it('configures dead letter queue for process-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Third createQueue call (PROCESS_SUBMISSION_FEATURES) should have DLQ config
      const queueConfig = createQueueStub.thirdCall.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(queueConfig.retryLimit).to.equal(2);
      expect(queueConfig.retryBackoff).to.equal(true);
    });

    it('registers all job handlers including dead letter queue handler', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // 3 handlers: TEST, PROCESS_SUBMISSION_FEATURES, PROCESS_SUBMISSION_FEATURES_FAILED
      expect(workStub.callCount).to.equal(3);
    });

    it('configures batchSize for batch processing', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // All handlers use the same batch size
      expect(workStub.firstCall.args[1].batchSize).to.equal(4);
      expect(workStub.secondCall.args[1].batchSize).to.equal(4);
      expect(workStub.thirdCall.args[1].batchSize).to.equal(4);
    });

    it('registers dead letter queue handler for failed jobs', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Third work call is for PROCESS_SUBMISSION_FEATURES_FAILED
      expect(workStub.thirdCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(workStub.thirdCall.args[2]).to.equal(processSubmissionFeaturesJob.processSubmissionFeaturesFailedHandler);
    });
  });
});
