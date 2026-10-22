/**
 * Delay before a derived-cache recompute job (closure, scope anchors) starts.
 *
 * Admins often make several policy or security-rule edits in a row. The first edit queues the recompute this long
 * in the future under its singleton key, and every edit before it starts is absorbed into that queued job, which
 * reads the latest state when it runs.
 */
export const DERIVED_CACHE_RECOMPUTE_DELAY_SECONDS = 10;
