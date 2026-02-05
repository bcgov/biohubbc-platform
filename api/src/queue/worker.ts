import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { IMalwareScanJobData, malwareScanFailedHandler, malwareScanJobHandler } from './jobs/malware-scan-job';
import {
  IProcessSubmissionFeaturesJobData,
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

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true
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
  await boss.work<IProcessSubmissionFeaturesJobData>(
    JobQueues.PROCESS_SUBMISSION_FEATURES,
    processSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed jobs
  await boss.work<IProcessSubmissionFeaturesJobData>(
    JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    processSubmissionFeaturesFailedHandler
  );

  // Register malware scan job handler
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN, malwareScanJobHandler);

  // Register dead letter queue handler for failed malware scan jobs
  await boss.work<IMalwareScanJobData>(JobQueues.MALWARE_SCAN_FAILED, malwareScanFailedHandler);

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues)
  });
};
