import { defaultPoolConfig, initDBPool } from './database/db';
import { initDBConstants } from './database/db-constants';
import { initPgBoss, stopPgBoss } from './queue/pg-boss-service';
import { registerWorkers } from './queue/worker';
import { getLogger } from './utils/logger';

const defaultLog = getLogger('queue');

/**
 * Start the queue process.
 *
 * @return {*}  {Promise<void>}
 */
const startQueue = async (): Promise<void> => {
  defaultLog.info({ label: 'startQueue', message: 'Initializing queue process' });

  // Initialize database pool
  initDBPool(defaultPoolConfig);
  await initDBConstants();

  // Initialize pg-boss
  await initPgBoss();

  // Register job handlers
  await registerWorkers();

  defaultLog.info({ label: 'startQueue', message: 'Queue process running' });
};

/**
 * Gracefully shutdown the queue process.
 *
 * @param {string} signal - The signal that triggered the shutdown
 * @return {*}  {Promise<void>}
 */
const shutdown = async (signal: string): Promise<void> => {
  defaultLog.info({ label: 'shutdown', message: `Received ${signal}, shutting down` });
  await stopPgBoss();
  process.exit(0);
};

// Handle graceful shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the queue process
try {
  await startQueue();
} catch (error) {
  defaultLog.error({ label: 'startQueue', message: 'Failed to start queue', error });
  process.exit(1);
}
