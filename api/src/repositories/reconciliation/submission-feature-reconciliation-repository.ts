import SQL from 'sql-template-strings';
import { CountResult } from '../../models/count';
import { ReconciliationCountRow, ReconciliationCounts } from '../../models/reconciliation';
import { BaseRepository } from '../base-repository';

/** Reconciles upload-owned submission_feature rows with current published state. */
export class SubmissionFeatureReconciliationRepository extends BaseRepository {
  /**
   * Find the newest reviewable upload that this upload supersedes.
   *
   * @param {string} submissionUploadId Incoming submission upload identifier.
   * @param {number} submissionId Submission identifier.
   * The selected upload is locked before the caller takes the submission feature-state lock, matching
   * the lock order used by upload approval.
   *
   * @returns {Promise<string | null>} Latest locked, indexed, submitted upload identifier, if one exists.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async getPredecessorSubmissionUploadId(submissionUploadId: string, submissionId: number): Promise<string | null> {
    const sql = SQL`
      SELECT candidate.submission_upload_id
      FROM submission_upload candidate
      JOIN LATERAL (
        SELECT status
        FROM submission_upload_status
        WHERE submission_upload_id = candidate.submission_upload_id
        ORDER BY submission_upload_status_id DESC
        LIMIT 1
      ) review ON true
      WHERE candidate.submission_id = ${submissionId}
        AND candidate.submission_upload_id <> ${submissionUploadId}::uuid
        AND candidate.status = 'indexed'
        AND candidate.successor_submission_upload_id IS NULL
        AND candidate.record_end_date IS NULL
        AND review.status = 'submitted'
      ORDER BY candidate.create_date DESC, candidate.submission_upload_id DESC
      LIMIT 1
      FOR UPDATE OF candidate;
    `;

    const response = await this.connection.sql(sql);
    return response.rows[0]?.submission_upload_id ?? null;
  }

  /**
   * Delete existing source-identity errors for an upload before validation is rerun.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>} Resolves after the prior source-identity errors are deleted.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async deleteSourceIdentityErrors(submissionUploadId: string): Promise<void> {
    const sql = SQL`
      DELETE FROM submission_feature_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND error_code IN ('MISSING_FEATURE_SOURCE_ID', 'DUPLICATE_FEATURE_SOURCE_ID');
    `;

    await this.connection.sql(sql);
  }

  /**
   * Identify and persist missing and duplicate source-identity errors for an upload.
   *
   * Detection remains database-side so potentially large source-identifier collections are never
   * materialized in the application. The returned count represents invalid feature occurrences,
   * which can exceed the number of inserted error rows when a duplicate group contains many rows.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<number>} Number of feature occurrences with an invalid source identifier.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async insertSourceIdentityErrors(submissionUploadId: string): Promise<number> {
    const sql = SQL`
      WITH missing AS (
        SELECT COUNT(*)::integer AS count
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_effective_date IS NULL
          AND record_end_date IS NULL
          AND NULLIF(btrim(source_id), '') IS NULL
      ),
      duplicates AS (
        SELECT
          source_id,
          COUNT(*)::integer AS count
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_effective_date IS NULL
          AND record_end_date IS NULL
          AND NULLIF(btrim(source_id), '') IS NOT NULL
        GROUP BY source_id
        HAVING COUNT(*) > 1
      ),
      invalid AS (
        SELECT
          NULL::text AS source_id,
          'MISSING_FEATURE_SOURCE_ID'::text AS error_code,
          count
        FROM missing
        WHERE count > 0

        UNION ALL

        SELECT
          source_id,
          'DUPLICATE_FEATURE_SOURCE_ID'::text AS error_code,
          count
        FROM duplicates
      ),
      inserted AS (
        INSERT INTO submission_feature_error (
          submission_upload_id,
          property_name,
          feature_type_property_id,
          error_code,
          error_message,
          count,
          details
        )
        SELECT
          ${submissionUploadId}::uuid,
          NULL,
          NULL,
          error_code,
          CASE error_code
            WHEN 'MISSING_FEATURE_SOURCE_ID' THEN 'A feature source_id is required'
            ELSE 'Multiple features in this upload share the same source_id'
          END,
          count,
          jsonb_build_object('source_id', source_id)
        FROM invalid
        RETURNING count
      )
      SELECT COALESCE(SUM(count), 0)::integer AS count
      FROM inserted;
    `;

    const response = await this.connection.sql(sql, CountResult);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Classify every pending feature against the preceding reviewable upload or published state.
   *
   * Baselines are matched by submission and source identifier. Pending and historical features are
   * excluded from baseline selection.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {number} submissionId Submission identifier used to scope published baselines.
   * @param {string | null} predecessorSubmissionUploadId Pending upload used as the preferred baseline.
   * @returns {Promise<void>} Resolves after reconciliation classifications are stored.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async reconcileSubmissionFeatures(
    submissionUploadId: string,
    submissionId: number,
    predecessorSubmissionUploadId: string | null
  ): Promise<void> {
    const sql = SQL`
      WITH classified AS (
        SELECT
          incoming.submission_feature_id,
          CASE
            WHEN baseline.submission_feature_id IS NULL THEN 'new'
            WHEN baseline.content_hash = incoming.content_hash THEN 'unmodified'
            ELSE 'modified'
          END::submission_feature_reconciliation_type AS reconciliation
        FROM submission_feature incoming
        LEFT JOIN LATERAL (
          SELECT candidate.submission_feature_id, candidate.content_hash
          FROM submission_feature candidate
          WHERE candidate.submission_id = ${submissionId}
            AND candidate.source_id = incoming.source_id
            AND (
              candidate.submission_upload_id = ${predecessorSubmissionUploadId}::uuid
              OR (
                candidate.record_effective_date <= now()
                AND (candidate.record_end_date IS NULL OR now() < candidate.record_end_date)
                AND candidate.successor_submission_feature_id IS NULL
              )
            )
          ORDER BY
            (candidate.submission_upload_id = ${predecessorSubmissionUploadId}::uuid) DESC,
            candidate.submission_feature_id DESC
          LIMIT 1
        ) baseline ON true
        WHERE incoming.submission_upload_id = ${submissionUploadId}::uuid
          AND incoming.record_effective_date IS NULL
          AND incoming.record_end_date IS NULL
      )
      UPDATE submission_feature incoming
      SET reconciliation = classified.reconciliation
      FROM classified
      WHERE incoming.submission_feature_id = classified.submission_feature_id;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Count the reconciliation classifications already stored for an upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<ReconciliationCounts>} Stored new, modified, and unmodified counts.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async getSubmissionFeatureReconciliationCounts(submissionUploadId: string): Promise<ReconciliationCounts> {
    const sql = SQL`
      SELECT reconciliation, COUNT(*)::integer AS count
      FROM submission_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND record_effective_date IS NULL
        AND record_end_date IS NULL
        AND reconciliation IS NOT NULL
      GROUP BY reconciliation;
    `;
    const response = await this.connection.sql(sql, ReconciliationCountRow);
    const counts: ReconciliationCounts = { new: 0, modified: 0, unmodified: 0 };
    for (const row of response.rows) {
      counts[row.reconciliation] = row.count;
    }
    return counts;
  }

  /**
   * Link current predecessors to their direct successors and end the predecessors.
   *
   * The caller must hold the submission feature-state lock and execute this method in the approval
   * transaction. Any currently published occurrence with the same source identifier is replaced.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {number} submissionId Submission identifier used to scope the lifecycle transition.
   * @returns {Promise<number>} Number of predecessor rows linked and ended.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async linkReconciledSubmissionFeaturePredecessors(submissionUploadId: string, submissionId: number): Promise<number> {
    const linkSql = SQL`
      UPDATE submission_feature predecessor
      SET
        successor_submission_feature_id = incoming.submission_feature_id,
        record_end_date = now()
      FROM submission_feature incoming
      WHERE incoming.submission_upload_id = ${submissionUploadId}::uuid
        AND incoming.submission_id = ${submissionId}
        AND incoming.reconciliation IS NOT NULL
        AND incoming.record_effective_date IS NULL
        AND incoming.record_end_date IS NULL
        AND predecessor.submission_id = incoming.submission_id
        AND predecessor.source_id = incoming.source_id
        AND predecessor.record_effective_date <= now()
        AND (predecessor.record_end_date IS NULL OR now() < predecessor.record_end_date)
        AND predecessor.successor_submission_feature_id IS NULL;
    `;
    const response = await this.connection.sql(linkSql);
    return response.rowCount ?? 0;
  }

  /**
   * Activate every reconciled incoming feature after predecessors have been linked.
   *
   * The caller must hold the submission feature-state lock and execute this method after predecessor
   * linking in the approval transaction.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {number} submissionId Submission identifier used to scope feature activation.
   * @returns {Promise<number>} Number of reconciled feature rows activated.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async activateReconciledSubmissionFeatures(submissionUploadId: string, submissionId: number): Promise<number> {
    const activateSql = SQL`
      UPDATE submission_feature
      SET record_effective_date = now()
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND submission_id = ${submissionId}
        AND reconciliation IS NOT NULL
        AND record_effective_date IS NULL
        AND record_end_date IS NULL;
    `;
    const response = await this.connection.sql(activateSql);
    return response.rowCount ?? 0;
  }
}
