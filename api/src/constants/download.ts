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
 * Build-side row budget for a single dimension in a denormalized export join.
 *
 * The broadcast join buffers each dimension table fully in memory; a dimension
 * over this budget fails fast and steers the client to the raw-Parquet path
 * rather than risking an out-of-memory join. Tunable via env var so ops can
 * dial it down under pod memory pressure (the right value tracks pod heap size)
 * without a code change — this is the primary build-side OOM guard.
 */
export const DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS = getNumberEnv('DOWNLOAD_EXPORT_DIMENSION_MAX_ROWS', 200_000);

/**
 * Cap on the cumulative number of joined rows a single root row may fan out to
 * in a denormalized export join.
 *
 * Arbitrary user-defined joins can match many dimension rows per step and
 * multiply output rows without bound; this cap protects output size and runtime.
 * Tunable via env var so ops can bound a high-cardinality join without a code
 * change.
 */
export const DOWNLOAD_EXPORT_FANOUT_MAX_ROWS = getNumberEnv('DOWNLOAD_EXPORT_FANOUT_MAX_ROWS', 100_000);

/**
 * Cache-invalidation key for the export-artifact-group layer. Written into every new group and
 * part of its dedupe key. Bump whenever the CSV/zip packing logic changes so the next identical
 * request misses the stale `ready` group and rebuilds.
 */
export const EXPORTER_VERSION = 1;
