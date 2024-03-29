import { defaultPoolConfig, initDBPool } from './database/db';
import { QueueScheduler } from './queue/queue-scheduler';
import { getLogger } from './utils/logger';

const defaultLog = getLogger('queue');

// Start queue
try {
  initDBPool(defaultPoolConfig);

  new QueueScheduler().start();

  defaultLog.info({ label: 'queue', message: 'started queue' });
} catch (error) {
  defaultLog.error({ label: 'queue', message: 'error', error });
  process.exit(1);
}
