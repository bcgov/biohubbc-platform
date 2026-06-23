import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { JobQueues } from './jobs';
import * as computeScopeAnchorsJob from './jobs/compute-scope-anchors-job';
import * as computeSubmissionFeatureClosureJob from './jobs/compute-submission-feature-closure-job';
import * as indexSubmissionFeaturesJob from './jobs/index-submission-features-job';
import * as malwareScanJob from './jobs/malware-scan-job';
import * as pollDownloadSchedulesJob from './jobs/poll-download-schedules-job';
import * as processDownloadJob from './jobs/process-download-job';
import * as processDownloadVersionExportJob from './jobs/process-download-version-export-job';
import * as processSubmissionFeaturesJob from './jobs/process-submission-features-job';
import * as submissionUploadSecurityJob from './jobs/submission-upload-security-job';
import { registerWorkers, workerDependencies } from './worker';

describe('worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('registerWorkers', () => {
    it('creates queues and registers handlers', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      expect(createQueueStub.callCount).to.equal(18);
      expect(createQueueStub.calledWith(JobQueues.PROCESS_SUBMISSION_FEATURES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.MALWARE_SCAN)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.PROCESS_DOWNLOAD)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.INDEX_SUBMISSION_FEATURES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.COMPUTE_SCOPE_ANCHORS)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.POLL_DOWNLOAD_SCHEDULES)).to.be.true;
      expect(createQueueStub.calledWith(JobQueues.SUBMISSION_UPLOAD_SECURITY)).to.be.true;

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
        workStub.calledWith(
          JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT,
          processDownloadVersionExportJob.processDownloadVersionExportJobHandler
        )
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED,
          processDownloadVersionExportJob.processDownloadVersionExportFailedHandler
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
      expect(
        workStub.calledWith(
          JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE,
          computeSubmissionFeatureClosureJob.computeSubmissionFeatureClosureJobHandler
        )
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED,
          computeSubmissionFeatureClosureJob.computeSubmissionFeatureClosureFailedHandler
        )
      ).to.be.true;
      expect(
        workStub.calledWith(JobQueues.POLL_DOWNLOAD_SCHEDULES, pollDownloadSchedulesJob.pollDownloadSchedulesJobHandler)
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED,
          pollDownloadSchedulesJob.pollDownloadSchedulesFailedHandler
        )
      ).to.be.true;

      // The poll is a recurring tick — scheduled on a fixed UTC interval after its queue exists.
      expect(scheduleStub.calledWith(JobQueues.POLL_DOWNLOAD_SCHEDULES, '0 * * * *')).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.SUBMISSION_UPLOAD_SECURITY,
          submissionUploadSecurityJob.submissionUploadSecurityJobHandler
        )
      ).to.be.true;
      expect(
        workStub.calledWith(
          JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED,
          submissionUploadSecurityJob.submissionUploadSecurityFailedHandler
        )
      ).to.be.true;
    });

    it('creates queues before registering workers (pg-boss v10 requirement)', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // createQueue is called for all queues (including dead letter queues)
      // 18 queues: PROCESS_SUBMISSION_FEATURES + FAILED, MALWARE_SCAN + FAILED, PROCESS_DOWNLOAD + FAILED, PROCESS_DOWNLOAD_VERSION_EXPORT + FAILED, INDEX_SUBMISSION_FEATURES + FAILED, COMPUTE_SCOPE_ANCHORS + FAILED, COMPUTE_SUBMISSION_FEATURE_CLOSURE + FAILED, POLL_DOWNLOAD_SCHEDULES + FAILED, SUBMISSION_UPLOAD_SECURITY + FAILED
      expect(createQueueStub.callCount).to.equal(18);
      expect(createQueueStub.firstCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES);
      expect(createQueueStub.thirdCall.args[0]).to.equal(JobQueues.MALWARE_SCAN_FAILED);
      expect(createQueueStub.getCall(3).args[0]).to.equal(JobQueues.MALWARE_SCAN);
      expect(createQueueStub.getCall(4).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_FAILED);
      expect(createQueueStub.getCall(5).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD);
      expect(createQueueStub.getCall(6).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED);
      expect(createQueueStub.getCall(7).args[0]).to.equal(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT);
      expect(createQueueStub.getCall(8).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(createQueueStub.getCall(9).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(createQueueStub.getCall(10).args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED);
      expect(createQueueStub.getCall(11).args[0]).to.equal(JobQueues.COMPUTE_SCOPE_ANCHORS);
      // Recompute closure DLQ is created before its main queue
      expect(createQueueStub.getCall(12).args[0]).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED);
      expect(createQueueStub.getCall(13).args[0]).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE);
      // Poll download schedules DLQ is created before its main queue
      expect(createQueueStub.getCall(14).args[0]).to.equal(JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED);
      expect(createQueueStub.getCall(15).args[0]).to.equal(JobQueues.POLL_DOWNLOAD_SCHEDULES);
      // Automatic security screening DLQ is created before its main queue
      expect(createQueueStub.getCall(16).args[0]).to.equal(JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED);
      expect(createQueueStub.getCall(17).args[0]).to.equal(JobQueues.SUBMISSION_UPLOAD_SECURITY);

      expect(createQueueStub.firstCall.calledBefore(workStub.firstCall)).to.be.true;
    });

    it('configures dead letter queue for process-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

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
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Second work call is for PROCESS_SUBMISSION_FEATURES_FAILED
      expect(workStub.secondCall.args[0]).to.equal(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);
      expect(workStub.secondCall.args[1]).to.equal(processSubmissionFeaturesJob.processSubmissionFeaturesFailedHandler);
    });

    it('registers the index submission features job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Index submission features handlers are registered after download + download-version-export handlers
      expect(workStub.getCall(8).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES);
      expect(workStub.getCall(8).args[1]).to.equal(indexSubmissionFeaturesJob.indexSubmissionFeaturesJobHandler);

      expect(workStub.getCall(9).args[0]).to.equal(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);
      expect(workStub.getCall(9).args[1]).to.equal(indexSubmissionFeaturesJob.indexSubmissionFeaturesFailedHandler);
    });

    it('configures dead letter queue for index-submission-features', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

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

    it('configures dead letter queue + policy:short for process-download-version-export', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // policy: 'short' — without it pg-boss ignores singletonKey, so two
      // concurrent export requests for the same group would both run.
      const exportQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT);
      expect(exportQueueCall).to.not.be.undefined;

      const queueConfig = exportQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.PROCESS_DOWNLOAD_VERSION_EXPORT_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });

    it('registers the compute scope anchors job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

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
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

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

    it('configures dead letter queue + policy:short for compute-submission-feature-closure', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // policy: 'short' — without it pg-boss ignores singletonKey, so two
      // concurrent recomputes for the same upload would both run.
      const closureQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE);
      expect(closureQueueCall).to.not.be.undefined;

      const queueConfig = closureQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });

    it('registers the compute submission feature closure job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Recompute closure handlers are registered after compute scope anchors handlers
      expect(workStub.getCall(12).args[0]).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE);
      expect(workStub.getCall(12).args[1]).to.equal(
        computeSubmissionFeatureClosureJob.computeSubmissionFeatureClosureJobHandler
      );

      expect(workStub.getCall(13).args[0]).to.equal(JobQueues.COMPUTE_SUBMISSION_FEATURE_CLOSURE_FAILED);
      expect(workStub.getCall(13).args[1]).to.equal(
        computeSubmissionFeatureClosureJob.computeSubmissionFeatureClosureFailedHandler
      );
    });

    it('registers the poll download schedules job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Poll download schedules handlers are registered after recompute closure handlers
      expect(workStub.getCall(14).args[0]).to.equal(JobQueues.POLL_DOWNLOAD_SCHEDULES);
      expect(workStub.getCall(14).args[1]).to.equal(pollDownloadSchedulesJob.pollDownloadSchedulesJobHandler);

      expect(workStub.getCall(15).args[0]).to.equal(JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED);
      expect(workStub.getCall(15).args[1]).to.equal(pollDownloadSchedulesJob.pollDownloadSchedulesFailedHandler);
    });

    it('configures dead letter queue for poll-download-schedules', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const pollQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.POLL_DOWNLOAD_SCHEDULES);
      expect(pollQueueCall).to.not.be.undefined;

      const queueConfig = pollQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.POLL_DOWNLOAD_SCHEDULES_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
    });

    it('schedules the poll on a recurring UTC cron after creating and working its queue', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      expect(scheduleStub.callCount).to.equal(1);
      expect(scheduleStub.firstCall.args[0]).to.equal(JobQueues.POLL_DOWNLOAD_SCHEDULES);
      expect(scheduleStub.firstCall.args[1]).to.equal('0 * * * *');
      expect(scheduleStub.firstCall.args[3]).to.deep.equal({ tz: 'UTC' });

      // schedule requires the queue to already exist and be worked
      const pollCreateCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.POLL_DOWNLOAD_SCHEDULES);
      const pollWorkCall = workStub.getCalls().find((call) => call.args[0] === JobQueues.POLL_DOWNLOAD_SCHEDULES);
      expect(pollCreateCall?.calledBefore(scheduleStub.firstCall)).to.be.true;
      expect(pollWorkCall?.calledBefore(scheduleStub.firstCall)).to.be.true;
    });

    it('configures dead letter queue + policy:short for submission-upload-security', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const screeningQueueCall = createQueueStub
        .getCalls()
        .find((call) => call.args[0] === JobQueues.SUBMISSION_UPLOAD_SECURITY);
      expect(screeningQueueCall).to.not.be.undefined;

      const queueConfig = screeningQueueCall?.args[1];
      expect(queueConfig.deadLetter).to.equal(JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED);
      expect(queueConfig.retryLimit).to.equal(3);
      expect(queueConfig.retryBackoff).to.equal(true);
      expect(queueConfig.policy).to.equal('short');
    });

    it('registers the submission upload security job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const createQueueStub = sinon.stub().resolves();
      const scheduleStub = sinon.stub().resolves();
      const mockBoss = { work: workStub, createQueue: createQueueStub, schedule: scheduleStub };

      sinon.stub(workerDependencies, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      // Screening handlers are registered after poll-download-schedules handlers (calls 16+17 out of 0-based indexing)
      expect(workStub.getCall(16).args[0]).to.equal(JobQueues.SUBMISSION_UPLOAD_SECURITY);
      expect(workStub.getCall(16).args[1]).to.equal(submissionUploadSecurityJob.submissionUploadSecurityJobHandler);

      expect(workStub.getCall(17).args[0]).to.equal(JobQueues.SUBMISSION_UPLOAD_SECURITY_FAILED);
      expect(workStub.getCall(17).args[1]).to.equal(submissionUploadSecurityJob.submissionUploadSecurityFailedHandler);
    });
  });
});
