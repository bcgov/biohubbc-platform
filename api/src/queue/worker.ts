import { SubmissionUpload } from '../models/submission-upload';
import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import {
  computeScopeAnchorsFailedHandler,
  computeScopeAnchorsJobHandler,
  IComputeScopeAnchorsJobData
} from './jobs/compute-scope-anchors-job';
import {
  IIndexSubmissionFeaturesJobData,
  indexSubmissionFeaturesFailedHandler,
  indexSubmissionFeaturesJobHandler
} from './jobs/index-submission-features-job';
import { IMalwareScanJobData, malwareScanFailedHandler, malwareScanJobHandler } from './jobs/malware-scan-job';
import {
  IProcessDownloadJobData,
  processDownloadFailedHandler,
  processDownloadJobHandler
} from './jobs/process-download-job';
import {
  processSubmissionFeaturesFailedHandler,
  processSubmissionFeaturesJobHandler
} from './jobs/process-submission-features-job';
import { getPgBoss } from './pg-boss-service';

const defaultLog = getLogger('queue/worker');

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 *
 * Testing convention: worker registration tests should stub this bag instead of
 * stubbing imported job modules directly.
 */
export interface WorkerDependencies {
  getPgBoss: typeof getPgBoss;
  processSubmissionFeaturesJobHandler: typeof processSubmissionFeaturesJobHandler;
  processSubmissionFeaturesFailedHandler: typeof processSubmissionFeaturesFailedHandler;
  malwareScanJobHandler: typeof malwareScanJobHandler;
  malwareScanFailedHandler: typeof malwareScanFailedHandler;
  processDownloadJobHandler: typeof processDownloadJobHandler;
  processDownloadFailedHandler: typeof processDownloadFailedHandler;
  indexSubmissionFeaturesJobHandler: typeof indexSubmissionFeaturesJobHandler;
  indexSubmissionFeaturesFailedHandler: typeof indexSubmissionFeaturesFailedHandler;
  computeScopeAnchorsJobHandler: typeof computeScopeAnchorsJobHandler;
  computeScopeAnchorsFailedHandler: typeof computeScopeAnchorsFailedHandler;
}

export const workerDependencies: WorkerDependencies = {
  getPgBoss,
  processSubmissionFeaturesJobHandler,
  processSubmissionFeaturesFailedHandler,
  malwareScanJobHandler,
  malwareScanFailedHandler,
  processDownloadJobHandler,
  processDownloadFailedHandler,
  indexSubmissionFeaturesJobHandler,
  indexSubmissionFeaturesFailedHandler,
  computeScopeAnchorsJobHandler,
  computeScopeAnchorsFailedHandler
};

/**
 * Register all job handlers with pg-boss.
 *
 * Add new job handler registrations here as they are created.
 *
 * @return {*}  {Promise<void>}
 */
export const registerWorkers = async (): Promise<void> => {
  const boss = workerDependencies.getPgBoss();

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' — enforces singleton_key uniqueness for queued (created) jobs.
  // Without this, the default 'standard' policy ignores singletonKey entirely.
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    policy: 'short'
  });

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.MALWARE_SCAN_FAILED);

  await boss.createQueue(JobQueues.MALWARE_SCAN, {
    deadLetter: JobQueues.MALWARE_SCAN_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register process submission features job handler
  await boss.work<SubmissionUpload>(
    JobQueues.PROCESS_SUBMISSION_FEATURES,
    workerDependencies.processSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed jobs
  await boss.work<SubmissionUpload>(
    JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    workerDependencies.processSubmissionFeaturesFailedHandler
  );

  // Register malware scan job handler
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN, workerDependencies.malwareScanJobHandler);

  // Register dead letter queue handler for failed malware scan jobs
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN_FAILED, workerDependencies.malwareScanFailedHandler);

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_DOWNLOAD_FAILED);

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.PROCESS_DOWNLOAD, {
    deadLetter: JobQueues.PROCESS_DOWNLOAD_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register process download job handler
  await boss.work<IProcessDownloadJobData>(JobQueues.PROCESS_DOWNLOAD, workerDependencies.processDownloadJobHandler);

  // Register dead letter queue handler for failed download jobs
  await boss.work<IProcessDownloadJobData>(
    JobQueues.PROCESS_DOWNLOAD_FAILED,
    workerDependencies.processDownloadFailedHandler
  );

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.INDEX_SUBMISSION_FEATURES_FAILED);

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.INDEX_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.INDEX_SUBMISSION_FEATURES_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register index submission features job handler
  await boss.work<IIndexSubmissionFeaturesJobData>(
    JobQueues.INDEX_SUBMISSION_FEATURES,
    workerDependencies.indexSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed index submission features jobs
  await boss.work<IIndexSubmissionFeaturesJobData>(
    JobQueues.INDEX_SUBMISSION_FEATURES_FAILED,
    workerDependencies.indexSubmissionFeaturesFailedHandler
  );

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED);

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.COMPUTE_SCOPE_ANCHORS, {
    deadLetter: JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true
  });

  // Register compute scope anchors job handler
  await boss.work<IComputeScopeAnchorsJobData>(
    JobQueues.COMPUTE_SCOPE_ANCHORS,
    workerDependencies.computeScopeAnchorsJobHandler
  );

  // Register dead letter queue handler for failed compute scope anchors jobs
  await boss.work<IComputeScopeAnchorsJobData>(
    JobQueues.COMPUTE_SCOPE_ANCHORS_FAILED,
    workerDependencies.computeScopeAnchorsFailedHandler
  );

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues)
  });
};
