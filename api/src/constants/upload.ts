/**
 * Multipart upload sizing and presign configuration.
 *
 * Naming convention:
 * - `S3_*` values are hard AWS multipart constraints.
 * - `UPLOAD_*` values are application policy knobs.
 *
 * All byte values are expressed in raw bytes (not MiB/GiB units).
 * These constants are intentionally centralized so frontend multipart planning and
 * backend ingestion behavior can be tuned via Helm/env without code changes.
 */

/**
 * Minimum allowed part size for S3 multipart uploads.
 *
 * S3 requires every part except the final one to be at least 5 MiB.
 * This is a hard protocol/API constraint.
 */
export const S3_MULTIPART_MIN_PART_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB

/**
 * Maximum allowed size of a single multipart part in S3.
 *
 * This is per-part size, not total object size.
 * Used as an absolute upper safety bound when deriving upload plans.
 */
export const S3_MULTIPART_MAX_PART_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB

/**
 * Maximum number of parts allowed by S3 for one multipart upload.
 *
 * If an initial plan would exceed this, part size must be increased.
 */
export const S3_MULTIPART_MAX_PARTS = 10000;

/**
 * Preferred target number of parts when computing multipart layout.
 *
 * This is a heuristic: planner tries to stay around this count for efficiency
 * (fewer requests/round-trips), but can exceed it when constrained by S3 limits.
 * Backward compatible fallback to legacy `UPLOAD_TARGET_PARTS`.
 */
export const UPLOAD_TARGET_PART_COUNT = Number(
  process.env.UPLOAD_TARGET_PART_COUNT ?? process.env.UPLOAD_TARGET_PARTS ?? 10
);

/**
 * Application-level soft cap for part size during multipart planning.
 *
 * Intended to keep part memory/network pressure predictable (default 100 MiB).
 * Note: this cap is soft relative to S3 hard constraints — planners may still need
 * larger parts to satisfy `S3_MULTIPART_MAX_PARTS` on very large uploads.
 * Backward compatible fallback to legacy `UPLOAD_DESIRED_MAX_PART_SIZE_BYTES`.
 */
export const UPLOAD_PART_SIZE_CAP_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_CAP_BYTES ?? process.env.UPLOAD_DESIRED_MAX_PART_SIZE_BYTES ?? 100 * 1024 * 1024
); // prefer max ~100 MiB part size unless S3 max-part-count requires larger

/**
 * File-size threshold where part-size ramping begins.
 *
 * For uploads at or below this size, planner can remain near minimum part size.
 * Above this threshold, part size increases stepwise to avoid too many tiny parts.
 */
export const UPLOAD_PART_SIZE_SCALE_START_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_SCALE_START_BYTES ?? process.env.UPLOAD_SCALE_START_BYTES ?? 20 * 1024 * 1024
);

/**
 * Upload-size interval used for each ramp step.
 *
 * Example with defaults:
 * - every additional 10 MiB of object size after `UPLOAD_PART_SIZE_SCALE_START_BYTES`
 *   advances one ramp step.
 */
export const UPLOAD_PART_SIZE_SCALE_STEP_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_SCALE_STEP_BYTES ?? process.env.UPLOAD_SCALE_STEP_BYTES ?? 10 * 1024 * 1024
);

/**
 * Part-size increase applied per ramp step.
 *
 * Example with defaults:
 * - each step adds +1 MiB to planned part size until capped by
 *   `UPLOAD_PART_SIZE_CAP_BYTES` (or overridden by S3 hard constraints).
 * Backward compatible fallback to legacy `UPLOAD_SCALE_STEP_PART_SIZE_BYTES`.
 */
export const UPLOAD_PART_SIZE_SCALE_STEP_INCREMENT_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_SCALE_STEP_INCREMENT_BYTES ??
    process.env.UPLOAD_SCALE_STEP_PART_SIZE_BYTES ??
    1024 * 1024
); // +1 MiB per step

/**
 * Number of presigned part URLs requested/generated per batch call.
 *
 * Batching reduces request payload size and avoids very large single presign responses
 * when uploads contain many parts.
 */
export const UPLOAD_PRESIGNED_URL_BATCH_SIZE = Number(process.env.UPLOAD_PRESIGNED_URL_BATCH_SIZE ?? 200);

/**
 * Expiry window (seconds) for generated presigned part URLs.
 *
 * Must be long enough for clients to upload all planned parts under normal conditions.
 */
export const UPLOAD_PRESIGNED_URL_EXPIRY_SECONDS = Number(process.env.UPLOAD_PRESIGNED_URL_EXPIRY_SECONDS ?? 3600);

/**
 * Maximum number of feature records buffered before a feature batch flush.
 *
 * Used during archive ingestion when streaming `features/*.json` entries.
 * Works together with `UPLOAD_FEATURE_BATCH_MAX_BYTES`; flush occurs when either
 * threshold is reached.
 */
export const UPLOAD_FEATURE_BATCH_SIZE = Number(process.env.UPLOAD_FEATURE_BATCH_SIZE ?? 10000);

/**
 * Approximate in-memory byte threshold for pending feature batch flush.
 *
 * Helps bound heap usage for large/verbose feature payloads where record count alone
 * is not sufficient. Parser computes an estimated per-feature byte contribution and
 * flushes when this threshold is reached.
 */
export const UPLOAD_FEATURE_BATCH_MAX_BYTES = Number(process.env.UPLOAD_FEATURE_BATCH_MAX_BYTES ?? 8 * 1024 * 1024);

/**
 * Maximum concurrent media uploads from `files/*` entries while streaming one archive.
 *
 * Higher values can improve throughput but increase memory/socket pressure.
 * Backward compatible fallback to legacy `SUBMISSION_ARCHIVE_MEDIA_CONCURRENCY`.
 */
export const UPLOAD_ARCHIVE_MEDIA_CONCURRENCY = Number(
  process.env.UPLOAD_ARCHIVE_MEDIA_CONCURRENCY ?? process.env.SUBMISSION_ARCHIVE_MEDIA_CONCURRENCY ?? 1
);

/**
 * Maximum jobs fetched per polling cycle for upload-processing workers.
 *
 * Keep this at 1 for memory-constrained workers (1 GiB / 1 vCPU) so a worker
 * processes one upload job at a time.
 */
export const UPLOAD_JOB_BATCH_SIZE = Number(process.env.UPLOAD_JOB_BATCH_SIZE ?? 1);

/**
 * Hard size limit for a single JSON archive entry (`features/*.json` or `codes/*.json`).
 *
 * Prevents unbounded buffering/parse of unexpectedly large JSON files and fails fast
 * with `IngestionValidationError` when exceeded.
 */
export const UPLOAD_ARCHIVE_JSON_FILE_MAX_BYTES = Number(
  process.env.UPLOAD_ARCHIVE_JSON_FILE_MAX_BYTES ?? 32 * 1024 * 1024
); // 32 MiB
