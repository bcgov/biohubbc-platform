import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { IMalwareScanJobData, malwareScanJobHandler } from './jobs/malware-scan-job';
import {
  IProcessSubmissionFeaturesJobData,
  processSubmissionFeaturesFailedHandler,
  processSubmissionFeaturesJobHandler
} from './jobs/process-submission-features-job';
import { ITestJobData, testJobHandler } from './jobs/test-job';
import { getPgBoss } from './pg-boss-service';

const defaultLog = getLogger('queue/worker');

/**
 * Default batch size (number of jobs fetched per poll).
 */
const DEFAULT_BATCH_SIZE = 4;

/**
 * Register all job handlers with pg-boss.
 *
 * Add new job handler registrations here as they are created.
 *
 * @return {*}  {Promise<void>}
 */
export const registerWorkers = async (): Promise<void> => {
  const boss = getPgBoss();

  // Ensure queues exist before registering workers
  await boss.createQueue(JobQueues.TEST);

  // Create dead letter queue first (must exist before main queue references it)
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED);

  // Create main queue with dead letter queue and retry configuration
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES, {
    deadLetter: JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 900
  });

  await boss.createQueue(JobQueues.MALWARE_SCAN);

  // Register test job handler
  await boss.work<ITestJobData>(
    JobQueues.TEST,
    {
      batchSize: DEFAULT_BATCH_SIZE
    },
    testJobHandler
  );

  // Register process submission features job handler
  await boss.work<IProcessSubmissionFeaturesJobData>(
    JobQueues.PROCESS_SUBMISSION_FEATURES,
    {
      batchSize: DEFAULT_BATCH_SIZE
    },
    processSubmissionFeaturesJobHandler
  );

  // Register dead letter queue handler for failed jobs
  await boss.work<IProcessSubmissionFeaturesJobData>(
    JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED,
    {
      batchSize: DEFAULT_BATCH_SIZE
    },
    processSubmissionFeaturesFailedHandler
  );

  // Register malware scan job handler
  await boss.work<IMalwareScanJobData>(
    JobQueues.MALWARE_SCAN,
    {
      batchSize: DEFAULT_BATCH_SIZE
    },
    malwareScanJobHandler
  );

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues),
    batchSize: DEFAULT_BATCH_SIZE
  });
};
