import { config } from './config.js';
import { getLogger } from './utils/logger.js';

const defaultLog = getLogger('metrics');

const counters = {
  requests: 0,
  upstreamFetches: 0,
  upstreamErrors: 0,
  upstreamDurationMsTotal: 0,
  upstreamDurationMsMax: 0
};

/**
 * Count one handled tile request, including ones served by a coalesced in-flight fetch.
 *
 * @return {void}
 */
export const recordRequest = () => {
  counters.requests++;
};

/**
 * Count one actual round trip to Martin, and fold its duration into the running total and maximum.
 *
 * @param {number} upstreamDurationMs - Wall clock duration of the upstream request.
 * @return {void}
 */
export const recordUpstreamFetch = (upstreamDurationMs: number) => {
  counters.upstreamFetches++;
  counters.upstreamDurationMsTotal += upstreamDurationMs;
  counters.upstreamDurationMsMax = Math.max(counters.upstreamDurationMsMax, upstreamDurationMs);
};

/**
 * Count one upstream response that was not a tile, an empty tile, or an unknown source.
 *
 * @return {void}
 */
export const recordUpstreamError = () => {
  counters.upstreamErrors++;
};

/**
 * Current metrics snapshot: request volume and upstream latency.
 *
 * The gap between `requests` and `upstreamFetches` is work absorbed by in-flight coalescing. Tile
 * cache effectiveness is reported by Martin, which is where the tiles are cached.
 *
 * @return {*}
 */
export const getMetrics = () => {
  return {
    requests: counters.requests,
    upstreamFetches: counters.upstreamFetches,
    upstreamErrors: counters.upstreamErrors,
    upstreamAvgMs: counters.upstreamFetches
      ? Math.round(counters.upstreamDurationMsTotal / counters.upstreamFetches)
      : 0,
    upstreamMaxMs: counters.upstreamDurationMsMax
  };
};

/**
 * Start periodically logging metrics.
 *
 * Log based rather than a scrape endpoint: the gateway exposes exactly one public route, and adding
 * a metrics endpoint would widen that surface.
 *
 * @return {*}  {NodeJS.Timeout}
 */
export const startMetricsReporting = (): NodeJS.Timeout => {
  const timer = setInterval(() => {
    const metrics = getMetrics();

    if (metrics.requests) {
      defaultLog.info({ message: 'Martin Gateway metrics', ...metrics });
    }
  }, config.metricsIntervalSeconds * 1000);

  // Do not hold the process open purely to report metrics.
  timer.unref();

  return timer;
};

/**
 * Reset all counters. Test seam.
 *
 * @return {void}
 */
export const resetMetrics = () => {
  counters.requests = 0;
  counters.upstreamFetches = 0;
  counters.upstreamErrors = 0;
  counters.upstreamDurationMsTotal = 0;
  counters.upstreamDurationMsMax = 0;
};
