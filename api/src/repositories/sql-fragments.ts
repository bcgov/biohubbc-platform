/**
 * Reusable SQL fragment builders for repository queries.
 *
 * These return raw SQL strings intended for interpolation into larger queries.
 * They are NOT parameterized — callers must only pass trusted column references
 * (e.g. 'sf.submission_feature_id'), never user input.
 */

/**
 * Per-row "effectively secured" check: walks UP from a feature through its
 * ancestors to determine if it or any ancestor has an active security rule
 * whose feature is past its effective date.
 *
 * Returns an `EXISTS (...)` SQL expression suitable for use in WHERE clauses
 * or as a SELECT column (returns boolean).
 *
 * Cost is O(tree_depth) per row (~3–5 levels), bounded by the feature
 * hierarchy depth regardless of total feature count.
 *
 * @param featureIdExpr SQL expression for the starting submission_feature_id
 *   (e.g. 'wf.submission_feature_id', 'candidate.submission_feature_id')
 */
export function isEffectivelySecured(featureIdExpr: string): string {
  return `EXISTS (
    WITH RECURSIVE ancestor_chain(id) AS (
      SELECT ${featureIdExpr}
      UNION ALL
      SELECT p.parent_submission_feature_id
      FROM ancestor_chain ac
      JOIN submission_feature p ON p.submission_feature_id = ac.id
      WHERE p.parent_submission_feature_id IS NOT NULL
        AND p.record_end_date IS NULL
    )
    SELECT 1 FROM ancestor_chain ac
    JOIN submission_feature_security sfs ON sfs.submission_feature_id = ac.id
    JOIN submission_feature sf_sec ON sf_sec.submission_feature_id = ac.id
    WHERE sfs.record_end_date IS NULL
      AND sf_sec.record_effective_date <= now()
  )`;
}
