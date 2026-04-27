import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { JobQueues } from './jobs';
import * as computeScopeAnchorsJob from './jobs/compute-scope-anchors-job';
import * as indexSubmissionFeaturesJob from './jobs/index-submission-features-job';
import * as malwareScanJob from './jobs/malware-scan-job';
import * as processDownloadExportJob from './jobs/process-download-export-job';
import * as processDownloadJob from './jobs/process-download-job';
import * as processSubmissionFeaturesJob from './jobs/process-submission-features-job';
import { registerWorkers, workerDependencies } from './worker';

describe('worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('registerWorkers', () => {
    it('creates queues and registers handlers', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      expect(createQueueStub.callCount).to.equal(12);
      expect(createQueueStub.calledWith(JobQueues.PROCESS_SUBMISSION_FEATURES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.MALWARE_SCAN)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.PROCESS_DOWNLOAD)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.PROCESS_DOWNLOAD_EXPORT)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.INDEX_SUBMISSION_FEATURES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.COMPUTE_SCOPE_ANCHORS)).to.be.true;

      expect(
        workStub.calledWith(
          JobQueues.PROCESS_SUBMISSION_FEATURES,
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
      expect(workStub.calledWith(JobQueues.MALWARE_SCAN_FAILED, malwareScanJob.malwareScanFailedHandler)).to.be.true;
      expect(workStub.calledWith(JobQueues.PROCESS_DOWNLOAD, processDownloadJob.processDownloadJobHandler)).to.be.true;
      expect(workStub.calledWith(JobQueues.PROCESS_DOWNLOAD_FAILED, processDownloadJob.processDownloadFailedHandler)).to
        .be.true;
      expect(
        workStub.calledWith(JobQueues.PROCESS_DOWNLOAD_EXPORT, processDownloadExportJob.processDownloadExportJobHandler)
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.PROCESS_DOWNLOAD_EXPORT_FAILED,
          processDownloadExportJob.processDownloadExportFailedHandler
        )
      ).to.be.true;
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
      expect(
        workStub.calledWith(
          JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED,
          computeScopeAnchorsJob.computeScopeAnchorsFailedHandler
        )
      ).to.be.true;
    });

    it('creates queues before registering workers (pg-boss v10 requirement)', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // createQueue is called for all queues (including dead letter queues)
      // 12 queues: PROCESS_SUBMISSION_FEATURES + FAILED, MALWARE_SCAN + FAILED, PROCESS_DOWNLOAD + FAILED, PROCESS_DOWNLOAD_EXPORT + FAILED, INDEX_SUBMISSION_FEATURES + FAILED, COMPUTE_SCOPE_ANCHORS + FAILED
      expect(createQueueStub.callCount).to.equal(12);
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(createQueueStub.thirdCall.args[0]).to.equal(JobQueues.MALWARE_SCAN_FAILED);
      expect(createQueueStub.getCall(3).args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(createQueueStub.getCall(4).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_FAILED);
      expect(createQueueStub.getCall(5).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(createQueueStub.getCall(6).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_EXPORT_FAILED);
      expect(createQueueStub.getCall(7).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_EXPORT);
      expect(createQueueStub.getCall(8).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.getCall(9).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(createQueueStub.getCall(10).args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED);
      expect(createQueueStub.getCall(11).args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS);

      expect(createQueueStub.firstCall.calledBefore(workStub.firstCall)).to.be.true;
    });

    it('configures dead letter queue for process-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

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

    it('registers dead letter queue handler for failed jobs', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Second work call is for PROCESS_SUBMISSION_FEATURES_FAILED
      expect(workStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(workStub.secondCall.args[1]).to.equal(processSubmissionFeaturesJob.processSubmissionFeaturesFailedHandler);
    });

    it('registers the index submission features job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Index submission features handlers are registered after download + download-export handlers
      expect(workStub.getCall(8).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(workStub.getCall(8).args[1]).to.equal(indexSubmissionFeaturesJob.indexSubmissionFeaturesJobHandler);

      expect(workStub.getCall(9).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(workStub.getCall(9).args[1]).to.equal(indexSubmissionFeaturesJob.indexSubmissionFeaturesFailedHandler);
    });

    it('configures dead letter queue for index-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

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

    it('configures dead letter queue + policy:short for process-download-export', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // policy: 'short' — without it pg-boss ignores singletonKey, so two
      // concurrent POST /export calls for the same export would both run.
      const exportQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.PROCESS_DOWNLOAD_EXPORT);
      expect(exportQueueCall).to.not.be.undefined;

      const queueConfig = exportQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.PROCESS_DOWNLOAD_EXPORT_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });

    it('registers the compute scope anchors job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Compute scope anchors handlers are registered after index submission features handlers
      expect(workStub.getCall(10).args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS);
      expect(workStub.getCall(10).args[1]).to.equal(computeScopeAnchorsJob.computeScopeAnchorsJobHandler);

      expect(workStub.getCall(11).args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED);
      expect(workStub.getCall(11).args[1]).to.equal(computeScopeAnchorsJob.computeScopeAnchorsFailedHandler);
    });

    it('configures dead letter queue for compute-scope-anchors', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const scopeQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.COMPUTE_SCOPE_ANCHORS);
      expect(scopeQueueCall).to.not.be.undefined;

      const queueConfig = scopeQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
    });
  });
});
