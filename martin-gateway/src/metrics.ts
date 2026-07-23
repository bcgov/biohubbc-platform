import { getCacheStats } from './cache/tile-cache.js';
import { config } from './config.js';
import { getLogger } from './utils/logger.js';

const defaultLog = getLogger('metrics');

const counters = {
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  upstreamErrors: 0,
  upstreamDurationMsTotal: 0,
  upstreamDurationMsMax: 0
};

export const recordCacheHit = () => {
  counters.requests++;
  counters.cacheHits++;
};

export const recordCacheMiss = (upstreamDurationMs: number) => {
  counters.requests++;
  counters.cacheMisses++;
  counters.upstreamDurationMsTotal += upstreamDurationMs;
  counters.upstreamDurationMsMax = Math.max(counters.upstreamDurationMsMax, upstreamDurationMs);
};

export const recordUpstreamError = () => {
  counters.upstreamErrors++;
};

/**
 * Current metrics snapshot: cache hit ratio and upstream latency.
 *
 * @return {*}
 */
export const getMetrics = () => {
  const { cacheHits, cacheMisses } = counters;
  const total = cacheHits + cacheMisses;

  return {
    requests: counters.requests,
    cacheHits,
    cacheMisses,
    cacheHitRatio: total ? Number((cacheHits / total).toFixed(3)) : 0,
    upstreamErrors: counters.upstreamErrors,
    upstreamAvgMs: cacheMisses ? Math.round(counters.upstreamDurationMsTotal / cacheMisses) : 0,
    upstreamMaxMs: counters.upstreamDurationMsMax,
    ...getCacheStats()
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
 */
export const resetMetrics = () => {
  counters.requests = 0;
  counters.cacheHits = 0;
  counters.cacheMisses = 0;
  counters.upstreamErrors = 0;
  counters.upstreamDurationMsTotal = 0;
  counters.upstreamDurationMsMax = 0;
};
