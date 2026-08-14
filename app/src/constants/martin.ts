/**
 * Constants shared by the Martin tile-session hooks (search-result map view and feature-page map).
 */

/** Refresh a tile session this many seconds before its token expires, so a tile request never races the expiry. */
export const MARTIN_REFRESH_LEAD_SECONDS = 60;

/**
 * How many times a tile error may trigger an automatic re-mint before the map gives up and surfaces an error.
 * Bounds a persistent, non-token failure (eg: the tile service is down) to a few attempts rather than an unbounded
 * storm of re-mints.
 */
export const MARTIN_MAX_AUTO_RECOVERIES = 2;

/**
 * Base delay before the first automatic recovery re-mint; each further attempt doubles it. Immediate back-to-back
 * re-mints would hammer a service that is down with several requests inside a second, while a short exponential
 * backoff gives a restarting service time to come back between attempts.
 */
export const MARTIN_AUTO_RECOVERY_BACKOFF_BASE_MS = 1000;
