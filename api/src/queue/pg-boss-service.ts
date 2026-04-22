import PgBoss from 'pg-boss';
import { getLogger } from '../utils/logger';
import { getPgBossConfig } from './pg-boss-config';

const defaultLog = getLogger('queue/pg-boss-service');

/**
 * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
 */
export const pgBossDependencies = {
  getPgBossConfig
};

// Singleton is hoisted onto globalThis to survive the dual module graph that
// express-openapi/openapi-framework creates: API path files are require()'d
// through tsx's CJS transformer, producing a second copy of every imported
// module (including this one) with its own module-scoped state. Storing the
// instance on globalThis ensures both graphs resolve to the same pg-boss.
const GLOBAL_KEY = Symbol.for('biohub.pgBoss');
const GLOBAL_INIT_KEY = Symbol.for('biohub.pgBoss.init');
type GlobalWithPgBoss = typeof globalThis & {
  [GLOBAL_KEY]?: PgBoss | null;
  [GLOBAL_INIT_KEY]?: Promise<PgBoss> | null;
};
const globalRef = globalThis as GlobalWithPgBoss;

const getBoss = (): PgBoss | null => globalRef[GLOBAL_KEY] ?? null;
const setBoss = (value: PgBoss | null): void => {
  globalRef[GLOBAL_KEY] = value;
};
const getInitPromise = (): Promise<PgBoss> | null => globalRef[GLOBAL_INIT_KEY] ?? null;
const setInitPromise = (value: Promise<PgBoss> | null): void => {
  globalRef[GLOBAL_INIT_KEY] = value;
};

/**
 * Initialize the pg-boss singleton instance.
 *
 * Concurrent callers share a single in-flight init promise. Without this guard,
 * two near-simultaneous calls would both see the singleton as null and each
 * construct + start their own `PgBoss`, leaving two running instances with the
 * only-one-wins semantics of `setBoss` — but the loser would still be connected
 * and consuming jobs until the process exits.
 *
 * @return {*}  {Promise<PgBoss>} The pg-boss singleton instance.
 */
export const initPgBoss = async (): Promise<PgBoss> => {
  const existing = getBoss();
  if (existing) {
    return existing;
  }

  const inFlight = getInitPromise();
  if (inFlight) {
    return inFlight;
  }

  const initPromise = (async () => {
    const config = pgBossDependencies.getPgBossConfig();
    const boss = new PgBoss(config);

    boss.on('error', (error) => {
      defaultLog.error({ label: 'pg-boss', message: 'error', error });
    });

    await boss.start();
    setBoss(boss);
    defaultLog.info({ label: 'pg-boss', message: 'started' });

    return boss;
  })();

  setInitPromise(initPromise);

  try {
    return await initPromise;
  } catch (error) {
    // Clear the cached promise on failure so a later caller can retry.
    setInitPromise(null);
    throw error;
  }
};

/**
 * Get the pg-boss singleton instance.
 *
 * @throws {Error} if pg-boss has not been initialized
 * @return {*}  {PgBoss}
 */
export const getPgBoss = (): PgBoss => {
  const boss = getBoss();
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
  const boss = getBoss();
  if (boss) {
    await boss.stop();
    setBoss(null);
    setInitPromise(null);
    defaultLog.info({ label: 'pg-boss', message: 'stopped' });
  }
};
