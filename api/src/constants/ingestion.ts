import { getNumberEnv } from '../utils/env-utils';

/**
 * Feature records buffered per batch while streaming submission archives.
 */
export const INGESTION_FEATURE_BATCH_SIZE = getNumberEnv('INGESTION_FEATURE_BATCH_SIZE', 10000);

/**
 * Contributor codes inserted per DB write batch.
 */
export const INGESTION_CONTRIBUTOR_CODE_BATCH_SIZE = getNumberEnv('INGESTION_CONTRIBUTOR_CODE_BATCH_SIZE', 10000);

/**
 * Approximate media bytes buffered before a media ingest flush.
 */
export const INGESTION_MEDIA_BATCH_BYTES = getNumberEnv('INGESTION_MEDIA_BATCH_BYTES', 50 * 1024 * 1024);

/**
 * Media files buffered before a media ingest flush.
 */
export const INGESTION_MEDIA_BATCH_FILES = getNumberEnv('INGESTION_MEDIA_BATCH_FILES', 10000);
