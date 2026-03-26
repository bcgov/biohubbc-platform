/**
 * URN pattern components for a security scope.
 * Resolved once per scope via `resolveUrnForScope` and passed to each batch.
 */
export interface SecurityScopeUrn {
  urn_submission_id: string;
  urn_feature_type: string;
  urn_feature_id: string;
}

/**
 * Result of a single anchor computation batch.
 * Contains the keyset cursor for the next batch.
 */
export interface AnchorBatchResult {
  pageLastId: number;
}
