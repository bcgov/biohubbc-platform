import { createHash } from 'node:crypto';

/** The two identities the search read paths can resolve. There is deliberately no admin class. */
export type TileContextAccessClass = 'anon' | 'scoped';

export interface TileContextHashInput {
  /** Semantic hash of the normalized search expression, or null for an unfiltered browse-all view. */
  expressionHash: string | null;
  featureTypeId: number;
  accessClass: TileContextAccessClass;
  /** Security scopes resolved for the caller. Empty for anonymous. */
  securityScopeIds: string[];
}

/**
 * Compute the dedup key for a tile context.
 *
 * Two requests share a context, and therefore share cached tiles, only when all four inputs match.
 * Including the access class and the full scope set is what keeps that safe: an anonymous caller and
 * an authenticated one never collide, and neither do two users whose team grants differ, even when
 * they run the same search. Scope ids are sorted so an ordering difference cannot produce a
 * different key for identical access.
 *
 * @param {TileContextHashInput} input
 * @return {*}  {string} SHA-256 hex hash.
 */
export const computeTileContextHash = (input: TileContextHashInput): string => {
  const identity = JSON.stringify({
    expression: input.expressionHash,
    feature_type_id: input.featureTypeId,
    access_class: input.accessClass,
    scope_ids: [...input.securityScopeIds].sort()
  });

  return createHash('sha256').update(identity).digest('hex');
};
