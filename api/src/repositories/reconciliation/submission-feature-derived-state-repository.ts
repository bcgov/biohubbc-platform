import SQL from 'sql-template-strings';
import { BaseRepository } from '../base-repository';

/**
 * Repository for healing derived feature state after reconciliation supersedes rows.
 *
 * Superseding a feature ends its row and publishes a replacement with a new
 * `submission_feature_id`; derived rows pointing at the ended row (parent links, feature
 * references, content relationships, security scope anchors) must be re-pointed to the
 * replacement. All healing is key-based — the replacement is the published live row with
 * the ended row's `(submission_id, feature_type_id, source_id)` — which makes it
 * idempotent, transitive across repeated supersessions, and able to heal links written by
 * concurrent uploads against a baseline that has since changed.
 *
 * @export
 * @class SubmissionFeatureDerivedStateRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureDerivedStateRepository extends BaseRepository {
  /**
   * Re-point parent links of the submission's live features that reference an ended row.
   *
   * The parent link is set to the published live row with the ended parent's
   * reconciliation key, or NULL when no such replacement exists.
   *
   * @param {number} submissionId The submission scope.
   * @returns {Promise<number>} Number of parent links updated.
   * @memberof SubmissionFeatureDerivedStateRepository
   */
  async repointParentLinksToActiveRows(submissionId: number): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_feature child
      SET parent_submission_feature_id = repl.submission_feature_id
      FROM submission_feature old
      LEFT JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE child.submission_id = ${submissionId}
        AND child.record_end_date IS NULL
        AND child.parent_submission_feature_id = old.submission_feature_id
        AND old.record_end_date IS NOT NULL;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Re-point feature-reference property rows of the submission's live features that
   * reference an ended row, then delete the stale rows that could not be re-pointed
   * because the healed reference already exists.
   *
   * `submission_feature_property_feature` is derived data — deleting the redundant stale
   * rows is allowed. References from ended features are left untouched as history.
   *
   * @param {number} submissionId The submission scope.
   * @returns {Promise<number>} Number of reference rows updated or deleted.
   * @memberof SubmissionFeatureDerivedStateRepository
   */
  async repointFeaturePropertyReferencesToActiveRows(submissionId: number): Promise<number> {
    const updateStatement = SQL`
      UPDATE submission_feature_property_feature p
      SET referenced_submission_feature_id = repl.submission_feature_id
      FROM submission_feature owner,
           submission_feature old
      JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE p.submission_feature_id = owner.submission_feature_id
        AND owner.submission_id = ${submissionId}
        AND owner.record_end_date IS NULL
        AND p.referenced_submission_feature_id = old.submission_feature_id
        AND old.record_end_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_property_feature dup
          WHERE dup.submission_feature_id = p.submission_feature_id
            AND dup.feature_type_property_id = p.feature_type_property_id
            AND dup.referenced_submission_feature_id = repl.submission_feature_id
        );
    `;

    const updateResponse = await this.connection.sql(updateStatement);

    const deleteStatement = SQL`
      DELETE FROM submission_feature_property_feature p
      USING submission_feature owner,
            submission_feature old
      JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE p.submission_feature_id = owner.submission_feature_id
        AND owner.submission_id = ${submissionId}
        AND owner.record_end_date IS NULL
        AND p.referenced_submission_feature_id = old.submission_feature_id
        AND old.record_end_date IS NOT NULL;
    `;

    const deleteResponse = await this.connection.sql(deleteStatement);

    return (updateResponse.rowCount ?? 0) + (deleteResponse.rowCount ?? 0);
  }

  /**
   * Re-point content relationships (`submission_feature_feature`) of the submission's
   * live features whose target is an ended row, then delete the stale rows that could
   * not be re-pointed (healed edge already exists, or healing would create a self-loop).
   *
   * Source-side rows of superseded features are not healed: the replacement row's own
   * relationships are rebuilt from its payload during indexing, and the ended row's
   * edges remain as history.
   *
   * @param {number} submissionId The submission scope.
   * @returns {Promise<number>} Number of relationship rows updated or deleted.
   * @memberof SubmissionFeatureDerivedStateRepository
   */
  async repointFeatureRelationshipsToActiveRows(submissionId: number): Promise<number> {
    const updateStatement = SQL`
      UPDATE submission_feature_feature ff
      SET target_feature_id = repl.submission_feature_id
      FROM submission_feature src,
           submission_feature old
      JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE ff.source_feature_id = src.submission_feature_id
        AND src.submission_id = ${submissionId}
        AND src.record_end_date IS NULL
        AND ff.target_feature_id = old.submission_feature_id
        AND old.record_end_date IS NOT NULL
        AND repl.submission_feature_id <> ff.source_feature_id
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_feature dup
          WHERE dup.source_feature_id = ff.source_feature_id
            AND dup.target_feature_id = repl.submission_feature_id
        );
    `;

    const updateResponse = await this.connection.sql(updateStatement);

    const deleteStatement = SQL`
      DELETE FROM submission_feature_feature ff
      USING submission_feature src,
            submission_feature old
      JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE ff.source_feature_id = src.submission_feature_id
        AND src.submission_id = ${submissionId}
        AND src.record_end_date IS NULL
        AND ff.target_feature_id = old.submission_feature_id
        AND old.record_end_date IS NOT NULL;
    `;

    const deleteResponse = await this.connection.sql(deleteStatement);

    return (updateResponse.rowCount ?? 0) + (deleteResponse.rowCount ?? 0);
  }

  /**
   * Re-point security scope anchors from ended rows of the submission to their published
   * replacements, then delete the stale anchors that could not be re-pointed because the
   * healed anchor already exists.
   *
   * Keeps team grants anchored to the live feature tree without waiting for the
   * per-scope anchor recompute job. Anchors on ended rows without a replacement are left
   * for the recompute job to reconcile holistically.
   *
   * @param {number} submissionId The submission scope.
   * @returns {Promise<number>} Number of anchor rows updated or deleted.
   * @memberof SubmissionFeatureDerivedStateRepository
   */
  async repointSecurityScopeAnchorsToActiveRows(submissionId: number): Promise<number> {
    const updateStatement = SQL`
      UPDATE security_scope_anchor a
      SET anchor_submission_feature_id = repl.submission_feature_id
      FROM submission_feature old
      JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE a.anchor_submission_feature_id = old.submission_feature_id
        AND old.submission_id = ${submissionId}
        AND old.record_end_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM security_scope_anchor dup
          WHERE dup.security_scope_id = a.security_scope_id
            AND dup.anchor_submission_feature_id = repl.submission_feature_id
        );
    `;

    const updateResponse = await this.connection.sql(updateStatement);

    const deleteStatement = SQL`
      DELETE FROM security_scope_anchor a
      USING submission_feature old
      JOIN submission_feature repl
        ON repl.submission_id = old.submission_id
       AND repl.feature_type_id = old.feature_type_id
       AND repl.source_id = old.source_id
       AND repl.record_end_date IS NULL
       AND repl.record_effective_date IS NOT NULL
      WHERE a.anchor_submission_feature_id = old.submission_feature_id
        AND old.submission_id = ${submissionId}
        AND old.record_end_date IS NOT NULL;
    `;

    const deleteResponse = await this.connection.sql(deleteStatement);

    return (updateResponse.rowCount ?? 0) + (deleteResponse.rowCount ?? 0);
  }

  /**
   * Copy live, active security rules from superseded predecessors onto their replacement
   * rows, so manually-applied protections survive a re-submission.
   *
   * Draft rules are not carried forward — the new upload's own screening regenerates
   * drafts. The original effective date and screening-event provenance are preserved on
   * the copy. `submission_feature_security` has no unique key on (feature, rule), so
   * duplicates are prevented with NOT EXISTS.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of security rule rows carried forward.
   * @memberof SubmissionFeatureDerivedStateRepository
   */
  async carryForwardSecurityRulesToReplacementRows(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature_security (
        submission_feature_id,
        security_rule_id,
        record_effective_date,
        status,
        submission_upload_security_id
      )
      SELECT DISTINCT ON (r.submission_feature_id, s.security_rule_id)
        r.submission_feature_id,
        s.security_rule_id,
        s.record_effective_date,
        s.status,
        s.submission_upload_security_id
      FROM submission_upload_feature_reconciliation r
      JOIN submission_feature_security s
        ON s.submission_feature_id = r.previous_submission_feature_id
      WHERE r.submission_upload_id = ${submissionUploadId}::uuid
        AND r.outcome = 'superseded'
        AND s.record_end_date IS NULL
        AND s.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_security dup
          WHERE dup.submission_feature_id = r.submission_feature_id
            AND dup.security_rule_id = s.security_rule_id
            AND dup.record_end_date IS NULL
        )
      ORDER BY r.submission_feature_id, s.security_rule_id, s.record_effective_date ASC;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }
}
