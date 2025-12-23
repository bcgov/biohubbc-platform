import { getLogger } from '../utils/logger';
import { JobQueues } from './jobs';
import { exampleJobHandler, IExampleJobData } from './jobs/example-job';
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

  // Register example job handler
  await boss.work<IExampleJobData>(
    JobQueues.EXAMPLE,
    {
      batchSize: DEFAULT_BATCH_SIZE
    },
    exampleJobHandler
  );

  // Register additional job handlers here:
  // await boss.work<ISomeJobData>(JobQueues.SOME_JOB, { ... }, someJobHandler);

  defaultLog.info({
    label: 'registerWorkers',
    message: 'Workers registered',
    queues: Object.values(JobQueues),
    batchSize: DEFAULT_BATCH_SIZE
  });
};
