import { IngestionJobData } from '../models/submission-upload';
import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
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
 * Register all job handlers with pg-boss.
 *
 * Add new job handler registrations here as they are created.
 *
 * @return {*}  {Promise<void>}
 */
export const registerWorkers = async (): Promise<void> => {
  const boss = getPgBoss();

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);

  // Create main queue with dead letter queue and retry configuration.
  // policy: 'short' — enforces singleton_key uniqueness for queued (created) jobs.
  // Without this, the default 'standard' policy ignores singletonKey entirely.
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    retryLimit: 0,
    retryDelay: 0,
    retryBackoff: false,
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
  await boss.work<IngestionJobData>(JobQueues.PROCESS_SUBMISSION_FEATURES, processSubmissionFeaturesJobHandler);

  // Register dead letter queue handler for failed jobs
  await boss.work<IngestionJobData>(
    JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    processSubmissionFeaturesFailedHandler
  );

  // Register malware scan job handler
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN, malwareScanJobHandler);

  // Register dead letter queue handler for failed malware scan jobs
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN_FAILED, malwareScanFailedHandler);

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
  await boss.work<IProcessDownloadJobData>(JobQueues.PROCESS_DOWNLOAD, processDownloadJobHandler);

  // Register dead letter queue handler for failed download jobs
  await boss.work<IProcessDownloadJobData>(JobQueues.PROCESS_DOWNLOAD_FAILED, processDownloadFailedHandler);

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
    indexSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed index submission features jobs
  await boss.work<IIndexSubmissionFeaturesJobData>(
    JobQueues.INDEX_SUBMISSION_FEATURES_FAILED,
    indexSubmissionFeaturesFailedHandler
  );

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues)
  });
};
