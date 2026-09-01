/**
 * Shared advisory-lock key definitions.
 *
 * Postgres advisory locks are keyed on bigints; the conventions here hash a prefixed
 * string with `hashtextextended(text, seed)`. Existing seeds in use: 1 (per-upload
 * closure recompute, legacy), 2 (per-upload security screening). Seed 3 is the
 * per-submission active-state lock.
 */

/**
 * Prefix for the per-submission active-state advisory lock.
 *
 * Serializes every writer of a submission's published feature state and its derived
 * closure: upload activation and closure recompute jobs both take the blocking form so
 * every upload continues to its upload-specific security screening.
 *
 * Use with {@link SUBMISSION_ACTIVE_STATE_LOCK_SEED} as
 * `hashtextextended('<prefix>:' || submission_id, seed)`.
 */
export const SUBMISSION_ACTIVE_STATE_LOCK_PREFIX = 'submission-feature-active-state';

/**
 * Hash seed for the per-submission active-state advisory lock.
 */
export const SUBMISSION_ACTIVE_STATE_LOCK_SEED = 3;
