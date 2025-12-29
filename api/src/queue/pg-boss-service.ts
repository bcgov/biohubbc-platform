import PgBoss from 'pg-boss';
import { getLogger } from '../utils/logger';
import { getPgBossConfig } from './pg-boss-config';

const defaultLog = getLogger('queue/pg-boss-service');

let boss: PgBoss | null = null;

/**
 * Initialize the pg-boss singleton instance.
 *
 * @return {*}  {Promise<PgBoss>}
 */
export const initPgBoss = async (): Promise<PgBoss> => {
  if (boss) {
    return boss;
  }

  const config = getPgBossConfig();
  boss = new PgBoss(config);

  boss.on('error', (error) => {
    defaultLog.error({ label: 'pg-boss', message: 'error', error });
  });

  boss.on('monitor-states', (states) => {
    defaultLog.debug({ label: 'pg-boss', message: 'states', states });
  });

  await boss.start();
  defaultLog.info({ label: 'pg-boss', message: 'started' });

  return boss;
};

/**
 * Get the pg-boss singleton instance.
 *
 * @throws {Error} if pg-boss has not been initialized
 * @return {*}  {PgBoss}
 */
export const getPgBoss = (): PgBoss => {
  if (!boss) {
    throw new Error('pg-boss not initialized. Call initPgBoss() first.');
  }
  return boss;
};

/**
 * Stop the pg-boss instance and release resources.
 *
 * @return {*}  {Promise<void>}
 */
export const stopPgBoss = async (): Promise<void> => {
  if (boss) {
    await boss.stop();
    boss = null;
    defaultLog.info({ label: 'pg-boss', message: 'stopped' });
  }
};
