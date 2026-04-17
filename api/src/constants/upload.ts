/**
 * Multipart upload sizing and presign configuration.
 *
 * Naming convention:
 * - `S3_*` values are hard AWS multipart constraints.
 * - `UPLOAD_*` values are application policy knobs.
 */

// AWS S3 multipart hard limits (per-part, not total-file size)
export const S3_MULTIPART_MIN_PART_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const S3_MULTIPART_MAX_PART_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB
export const S3_MULTIPART_MAX_PARTS = 10000;

// Upload policy knobs (env-configurable)
export const UPLOAD_TARGET_PART_COUNT = Number(
  process.env.UPLOAD_TARGET_PART_COUNT ?? process.env.UPLOAD_TARGET_PARTS ?? 10
);
export const UPLOAD_PART_SIZE_CAP_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_CAP_BYTES ?? process.env.UPLOAD_DESIRED_MAX_PART_SIZE_BYTES ?? 100 * 1024 * 1024
); // prefer max ~100 MiB part size unless S3 max-part-count requires larger

// Ramp part size gradually above small-file threshold to avoid tiny parts.
export const UPLOAD_PART_SIZE_SCALE_START_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_SCALE_START_BYTES ?? process.env.UPLOAD_SCALE_START_BYTES ?? 20 * 1024 * 1024
);
export const UPLOAD_PART_SIZE_SCALE_STEP_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_SCALE_STEP_BYTES ?? process.env.UPLOAD_SCALE_STEP_BYTES ?? 10 * 1024 * 1024
);
export const UPLOAD_PART_SIZE_SCALE_STEP_INCREMENT_BYTES = Number(
  process.env.UPLOAD_PART_SIZE_SCALE_STEP_INCREMENT_BYTES ??
    process.env.UPLOAD_SCALE_STEP_PART_SIZE_BYTES ??
    1024 * 1024
); // +1 MiB per step

export const UPLOAD_PRESIGNED_URL_BATCH_SIZE = Number(process.env.UPLOAD_PRESIGNED_URL_BATCH_SIZE ?? 200);
export const UPLOAD_PRESIGNED_URL_EXPIRY_SECONDS = Number(process.env.UPLOAD_PRESIGNED_URL_EXPIRY_SECONDS ?? 3600);
