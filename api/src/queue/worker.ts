import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import {
  IProcessSubmissionFeaturesJobData,
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

  // Create queues (pg-boss v10 requires this before work/send)
  await boss.createQueue(JobQueues.TEST);
  await boss.createQueue(JobQueues.PROCESS_SUBMISSION_FEATURES);

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

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues),
    batchSize: DEFAULT_BATCH_SIZE
  });
};
