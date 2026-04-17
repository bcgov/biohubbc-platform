export const FRAGMENT_SIZE_THRESHOLD = 200 * 1024 * 1024; // 200 MB per fragment
export const SIGNED_URL_EXPIRY_FRAGMENT = 432000; // 5 days for fragment URLs

/**
 * Rows per FETCH for streaming download cursors.
 *
 * Tunable via env var so ops can adjust memory pressure vs throughput without
 * a code change. Larger = fewer round trips but higher peak heap per batch.
 */
export const DOWNLOAD_FEATURE_BATCH_SIZE = Number(process.env.DOWNLOAD_FEATURE_BATCH_SIZE ?? 5000);
