import { Queue } from 'bullmq';
import { defaultPoolConfig, initDBPool } from '../database/db';
import { getLogger } from '../utils/logger';
import { queueConfig } from './config';
import { RedisQueuePublisher } from './publisher';
import { redisOptions } from './redis-connection';
import { startWorker } from './worker';

const defaultLog = getLogger('bullmq/index');

const bootstrap = async () => {
  try {
    initDBPool(defaultPoolConfig);
  } catch (error) {
    defaultLog.error({ label: 'bootstrap', message: 'failed to init DB pool', error });
    process.exit(1);
  }

  const queue = new Queue(queueConfig.queueName, { connection: redisOptions });

  const publisher = new RedisQueuePublisher(queue);
  publisher.start();

  const { worker, events } = startWorker();

  defaultLog.info({
    label: 'bootstrap',
    message: 'BullMQ worker and publisher started',
    queueName: queueConfig.queueName,
    syncIntervalMs: queueConfig.syncIntervalMs,
    workerConcurrency: queueConfig.workerConcurrency
  });

  const shutdown = async () => {
    defaultLog.info({ label: 'shutdown', message: 'gracefully shutting down BullMQ components' });
    await Promise.allSettled([worker.close(), queue.close(), events.close()]);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void bootstrap();
