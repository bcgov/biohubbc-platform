import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { JobQueues } from './jobs';
import * as indexSubmissionFeaturesJob from './jobs/index-submission-features-job';
import * as malwareScanJob from './jobs/malware-scan-job';
import * as processSubmissionFeaturesJob from './jobs/process-submission-features-job';
import * as refreshTeamFeatureCacheJob from './jobs/refresh-team-feature-cache-job';
import * as pgBossService from './pg-boss-service';
import { registerWorkers } from './worker';

describe('worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('registerWorkers', () => {
    it('registers the process submission features job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // First call is for PROCESS_SUBMISSION_FEATURES queue
      expect(workStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(workStub.firstCall.args[1]).to.equal(processSubmissionFeaturesJob.processSubmissionFeaturesJobHandler);
    });

    it('registers the malware scan job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Third call is for MALWARE_SCAN queue
      expect(workStub.getCall(2).args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(workStub.getCall(2).args[1]).to.equal(malwareScanJob.malwareScanJobHandler);
    });

    it('creates queues before registering workers (pg-boss v10 requirement)', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // createQueue is called for all queues (including dead letter queues)
      // 10 queues: PROCESS_SUBMISSION_FEATURES + FAILED, MALWARE_SCAN + FAILED, PROCESS_DOWNLOAD + FAILED, INDEX_SUBMISSION_FEATURES + FAILED, REFRESH_TEAM_FEATURE_CACHE + FAILED
      expect(createQueueStub.callCount).to.equal(10);
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(createQueueStub.thirdCall.args[0]).to.equal(JobQueues.MALWARE_SCAN_FAILED);
      expect(createQueueStub.getCall(3).args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(createQueueStub.getCall(4).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_FAILED);
      expect(createQueueStub.getCall(5).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(createQueueStub.getCall(6).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.getCall(7).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(createQueueStub.getCall(8).args[0]).to.equal(JobQueues.REFRESH_TEAM_FEATURE_CACHE_FAILED);
      expect(createQueueStub.getCall(9).args[0]).to.equal(JobQueues.REFRESH_TEAM_FEATURE_CACHE);
    });

    it('configures dead letter queue for process-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Second createQueue call (PROCESS_SUBMISSION_FEATURES) should have DLQ config
      // policy: 'short' — enforces singletonKey uniqueness for queued jobs
      const queueConfig = createQueueStub.secondCall.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(queueConfig.retryLimit).to.equal(2);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });

    it('registers dead letter queue handler for failed jobs', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Second work call is for PROCESS_SUBMISSION_FEATURES_FAILED
      expect(workStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(workStub.secondCall.args[1]).to.equal(processSubmissionFeaturesJob.processSubmissionFeaturesFailedHandler);
    });

    it('registers the index submission features job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Index submission features handlers are registered after download handlers
      expect(workStub.getCall(6).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(workStub.getCall(6).args[1]).to.equal(indexSubmissionFeaturesJob.indexSubmissionFeaturesJobHandler);

      expect(workStub.getCall(7).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(workStub.getCall(7).args[1]).to.equal(indexSubmissionFeaturesJob.indexSubmissionFeaturesFailedHandler);
    });

    it('configures dead letter queue for index-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // 8th createQueue call (INDEX_SUBMISSION_FEATURES) should have DLQ config
      const queueConfig = createQueueStub.getCall(7).args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
    });

    it('registers the refresh team feature cache job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Refresh team feature cache handlers are registered after index submission features
      expect(workStub.getCall(8).args[0]).to.equal(JobQueues.REFRESH_TEAM_FEATURE_CACHE);
      expect(workStub.getCall(8).args[1]).to.equal(refreshTeamFeatureCacheJob.refreshTeamFeatureCacheJobHandler);

      expect(workStub.getCall(9).args[0]).to.equal(JobQueues.REFRESH_TEAM_FEATURE_CACHE_FAILED);
      expect(workStub.getCall(9).args[1]).to.equal(refreshTeamFeatureCacheJob.refreshTeamFeatureCacheFailedHandler);
    });

    it('configures dead letter queue for refresh-team-feature-cache', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // 10th createQueue call (REFRESH_TEAM_FEATURE_CACHE) should have DLQ config with short policy
      const queueConfig = createQueueStub.getCall(9).args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.REFRESH_TEAM_FEATURE_CACHE_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });
  });
});
