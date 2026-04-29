export const FRAGMENT_SIZE_THRESHOLD = 200 * 1024 * 1024; // 200 MB per fragment
export const SIGNED_URL_EXPIRY_FRAGMENT = 432000; // 5 days for fragment URLs

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
export const DOWNLOAD_FEATURE_BATCH_SIZE = Number(process.env.DOWNLOAD_FEATURE_BATCH_SIZE ?? 5000);
