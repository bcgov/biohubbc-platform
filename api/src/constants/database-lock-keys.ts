/**
 * Shared advisory-lock key definitions.
 *
 * Postgres advisory locks are keyed on bigints; the conventions here hash a prefixed
 * string with `hashtextextended(text, seed)`. Existing seeds in use: 1 (per-upload
 * closure recompute, legacy), 2 (per-upload security screening). Seed 3 is the
 * per-submission active-state lock. Seed 4 is the per-upload ingestion lock.
 */

/**
 * Prefix for the per-submission active-state advisory lock.
 *
 * Serializes every writer of a submission's published feature state and its derived
 * closure: upload activation and closure recompute jobs both take the blocking form so
 * a recompute queued behind an activation always runs, and rebuilds from the activated state.
 *
 * Use with {@link SUBMISSION_ACTIVE_STATE_LOCK_SEED} as
 * `hashtextextended('<prefix>:' || submission_id, seed)`.
 */
export const SUBMISSION_ACTIVE_STATE_LOCK_PREFIX = 'submission-feature-active-state';

/**
 * Hash seed for the per-submission active-state advisory lock.
 */
export const SUBMISSION_ACTIVE_STATE_LOCK_SEED = 3;

/**
 * Prefix for the per-upload ingestion advisory lock.
 *
 * Held for the full process stage so an expired-and-retried ingestion job cannot delete or
 * insert rows for an upload while an earlier attempt is still streaming its archive.
 *
 * Use with {@link SUBMISSION_UPLOAD_INGESTION_LOCK_SEED} as
 * `hashtextextended('<prefix>:' || submission_upload_id, seed)`.
 */
export const SUBMISSION_UPLOAD_INGESTION_LOCK_PREFIX = 'submission-upload-ingestion';

/**
 * Hash seed for the per-upload ingestion advisory lock.
 */
export const SUBMISSION_UPLOAD_INGESTION_LOCK_SEED = 4;
