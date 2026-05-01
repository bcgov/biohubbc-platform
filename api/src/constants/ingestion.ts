/**
 * Feature records buffered per batch while streaming submission archives.
 *
 * Uses legacy `UPLOAD_FEATURE_BATCH_SIZE` as a backward-compatible fallback
 * during env-name migration.
 */
export const INGESTION_FEATURE_BATCH_SIZE = Number(
  process.env.INGESTION_FEATURE_BATCH_SIZE ?? process.env.UPLOAD_FEATURE_BATCH_SIZE ?? 10000
);

/**
 * Contributor codes inserted per DB write batch.
 */
export const INGESTION_CONTRIBUTOR_CODE_BATCH_SIZE = Number(process.env.INGESTION_CONTRIBUTOR_CODE_BATCH_SIZE ?? 10000);

/**
 * Approximate media bytes buffered before a media ingest flush.
 *
 * Uses legacy `MEDIA_INGEST_BATCH_BYTES` as a backward-compatible fallback
 * during env-name migration.
 */
export const INGESTION_MEDIA_BATCH_BYTES = Number(
  process.env.INGESTION_MEDIA_BATCH_BYTES ?? process.env.MEDIA_INGEST_BATCH_BYTES ?? 50 * 1024 * 1024
);

/**
 * Media files buffered before a media ingest flush.
 *
 * Uses legacy `MEDIA_INGEST_BATCH_FILES` as a backward-compatible fallback
 * during env-name migration.
 */
export const INGESTION_MEDIA_BATCH_FILES = Number(
  process.env.INGESTION_MEDIA_BATCH_FILES ?? process.env.MEDIA_INGEST_BATCH_FILES ?? 10000
);
