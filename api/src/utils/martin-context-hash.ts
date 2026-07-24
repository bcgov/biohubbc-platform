import { createHash } from 'node:crypto';

/** The two identities the search read paths can resolve. There is deliberately no admin class. */
export type MartinContextAccessClass = 'anon' | 'scoped';

export interface MartinContextHashInput {
  /** Semantic hash of the normalized search expression, or null for an unfiltered browse-all view. */
  expressionHash: string | null;
  featureTypeId: number;
  accessClass: MartinContextAccessClass;
  /** Security scopes resolved for the caller. Empty for anonymous. */
  securityScopeIds: string[];
}

/**
 * Compare two scope ids by UTF-16 code units.
 *
 * Deliberately NOT `localeCompare`: this ordering feeds a cross-machine hash key, and
 * `localeCompare` varies by locale/ICU data. Scope ids are ASCII UUIDs, so code-unit order is
 * deterministic everywhere and matches the default-sort behavior exactly.
 *
 * @param {string} a
 * @param {string} b
 * @return {*}  {number}
 */
const compareScopeIds = (a: string, b: string): number => {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
};

/**
 * Compute the dedup key for a tile context.
 *
 * Two requests share a context, and therefore share cached tiles, only when all four inputs match.
 * Including the access class and the full scope set is what keeps that safe: an anonymous caller and
 * an authenticated one never collide, and neither do two users whose team grants differ, even when
 * they run the same search. Scope ids are sorted so an ordering difference cannot produce a
 * different key for identical access.
 *
 * @param {MartinContextHashInput} input
 * @return {*}  {string} SHA-256 hex hash.
 */
export const computeMartinContextHash = (input: MartinContextHashInput): string => {
  const identity = JSON.stringify({
    expression: input.expressionHash,
    feature_type_id: input.featureTypeId,
    access_class: input.accessClass,
    scope_ids: [...input.securityScopeIds].sort(compareScopeIds)
  });

  return createHash('sha256').update(identity).digest('hex');
};
