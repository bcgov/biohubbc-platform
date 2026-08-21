import { getOptionalEnv } from './env-utils';

/** Default lifetime of a tile token, seconds. */
const DEFAULT_TOKEN_TTL_SECONDS = 900;

/** Default lifetime of a tile context, seconds. */
const DEFAULT_CONTEXT_TTL_SECONDS = 1800;

/** Default maximum live (unexpired) tile contexts. */
const DEFAULT_MAX_LIVE_CONTEXTS = 200;

export interface MartinConfig {
  /** Lifetime of a minted tile token, seconds. */
  tokenTtlSeconds: number;
  /** Lifetime of a tile context, seconds. Always at least the token lifetime. */
  contextTtlSeconds: number;
  /**
   * Maximum live (unexpired) tile contexts. At the cap a new one evicts the context closest to
   * expiry rather than being refused, so the bound costs the least useful session rather than
   * locking every caller out of new searches.
   */
  maxLiveContexts: number;
}

/**
 * Read a positive whole-number environment variable.
 *
 * A value that is present but unusable throws rather than falling back: silently substituting a
 * default turns a deployment typo into a service that runs with settings nobody chose.
 *
 * @param {string} name Environment variable name.
 * @param {number} defaultValue Value used when the variable is not set.
 * @return {*}  {number}
 */
const readPositiveWholeNumber = (name: string, defaultValue: number): number => {
  const raw = getOptionalEnv(name);

  if (raw === undefined) {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive whole number, received: ${raw}`);
  }

  return value;
};

/**
 * Read and validate the tile configuration from the environment.
 *
 * The token and the context are two expiries over one session, and the browser stops re-minting
 * once it holds a token. A context shorter than its token therefore leaves a session holding a
 * credential that still verifies against tiles the database will no longer generate, so the
 * relationship between the two is checked here rather than assumed at each read.
 *
 * @throws {Error} If any value is unusable, or the context lifetime is shorter than the token's.
 * @return {*}  {MartinConfig}
 */
export const getMartinConfig = (): MartinConfig => {
  const tokenTtlSeconds = readPositiveWholeNumber('MARTIN_TOKEN_TTL_SECONDS', DEFAULT_TOKEN_TTL_SECONDS);
  const contextTtlSeconds = readPositiveWholeNumber('MARTIN_CONTEXT_TTL_SECONDS', DEFAULT_CONTEXT_TTL_SECONDS);
  const maxLiveContexts = readPositiveWholeNumber('MARTIN_CONTEXT_MAX_LIVE', DEFAULT_MAX_LIVE_CONTEXTS);

  if (contextTtlSeconds < tokenTtlSeconds) {
    throw new Error(
      `MARTIN_CONTEXT_TTL_SECONDS (${contextTtlSeconds}) must be greater than or equal to MARTIN_TOKEN_TTL_SECONDS (${tokenTtlSeconds})`
    );
  }

  return { tokenTtlSeconds, contextTtlSeconds, maxLiveContexts };
};
