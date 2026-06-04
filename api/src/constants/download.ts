import { getNumberEnv } from '../utils/env-utils';

export const SIGNED_URL_EXPIRY_DOWNLOAD = 432000; // 5 days

/**
 * Default `download_export.max_part_size_bytes` (500 MB). Applied by the service
 * when a client omits `max_part_size_bytes` on export creation.
 */
export const DEFAULT_MAX_PART_SIZE_BYTES = '524288000';

/**
 * Rows per FETCH for streaming download cursors.
 *
 * Tunable via env var so ops can adjust memory pressure vs throughput without
 * a code change. Larger = fewer round trips but higher peak heap per batch.
 */
export const DOWNLOAD_FEATURE_BATCH_SIZE = getNumberEnv('DOWNLOAD_FEATURE_BATCH_SIZE', 5000);

/**
 * Cache-invalidation key for the export-artifact-group layer. Written into every new group and
 * part of its dedupe key. Bump whenever the CSV/zip packing logic changes so the next identical
 * request misses the stale `ready` group and rebuilds.
 */
export const EXPORTER_VERSION = 1;
