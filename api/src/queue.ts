import { defaultPoolConfig, initDBPool } from './database/db';
import { QueueScheduler } from './queue/queue-scheduler';
import { getLogger } from './utils/logger';

const defaultLog = getLogger('queue');

// Start api
try {
  initDBPool(defaultPoolConfig);

  new QueueScheduler();

  defaultLog.info({ label: 'queue', message: 'started queue' });
} catch (error) {
  defaultLog.error({ label: 'queue', message: 'error', error });
  process.exit(1);
}
