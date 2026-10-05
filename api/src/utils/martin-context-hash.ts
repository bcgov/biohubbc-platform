import { createHash } from 'node:crypto';

export interface MartinContextHashInput {
  /** Persisted normalized search expression id, or null for an unfiltered browse-all view. */
  expressionId: string | null;
  featureTypeId: number;
  /** Caller whose live authorization applies, or null for anonymous. */
  systemUserId: number | null;
  /** Sorted submission scope, or null for all submissions. */
  submissionIds?: number[] | null;
}

/**
 * Compute the dedup key for a tile context.
 *
 * Two requests share a context, and therefore share cached tiles, only when all identity inputs match.
 * The expression id is already deduplicated by the expression persistence layer (identical
 * normalized searches resolve to one id), so it is a stable identity for the search. Including the
 * user id is what keeps sharing safe: authorization is evaluated live per user at serve time, so two
 * users must never share a context even for the same search — while every anonymous caller (null)
 * running the same search shares one.
 *
 * @param {MartinContextHashInput} input
 * @return {*}  {string} SHA-256 hex hash.
 */
export const computeMartinContextHash = (input: MartinContextHashInput): string => {
  const identity = JSON.stringify({
    expression_id: input.expressionId,
    feature_type_id: input.featureTypeId,
    system_user_id: input.systemUserId,
    submission_ids: input.submissionIds ?? null
  });

  return createHash('sha256').update(identity).digest('hex');
};
