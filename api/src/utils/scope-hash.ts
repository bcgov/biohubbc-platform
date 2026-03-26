import { createHash } from 'node:crypto';

/**
 * Compute a deterministic SHA-256 hash of a normalized URN for scope deduplication.
 *
 * Multiple policies can reference the same access scope (e.g., `urn:*:telemetry:*`).
 * Hashing the URN produces a fixed-length key that enables deduplication via the
 * `security_scope.scope_hash` unique index — preventing duplicate anchor computation
 * and storage explosion.
 *
 * @param urn - The submission_feature_urn (e.g., 'urn:10:telemetry:*')
 * @returns SHA-256 hex string (always 64 characters)
 */
export function computeScopeHash(urn: string): string {
  return createHash('sha256').update(urn).digest('hex');
}
