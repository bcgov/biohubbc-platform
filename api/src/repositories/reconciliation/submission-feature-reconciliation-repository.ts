import SQL from 'sql-template-strings';
import { z } from 'zod';
import { BaseRepository } from '../base-repository';

export const SubmissionFeatureReconciliationOutcome = z.enum(['new', 'unchanged', 'superseded', 'conflict']);

export type SubmissionFeatureReconciliationOutcome = z.infer<typeof SubmissionFeatureReconciliationOutcome>;

/**
 * One row of the per-outcome tally returned by the classification query — the raw
 * `(outcome, count)` grouping. The service assembles these into a keyed counts object.
 */
export interface ReconciliationOutcomeCount {
  outcome: SubmissionFeatureReconciliationOutcome;
  count: number;
}

/**
 * Repository for reconciling a submission upload's pending features against the
 * submission's published feature state.
 *
 * Reconciliation identity is `(submission_id, feature_type_id, source_id)`. The upload's
 * pending rows (record_effective_date IS NULL, record_end_date IS NULL) are the staged
 * incoming features; the submission's published live rows (record_effective_date IS NOT
 * NULL, record_end_date IS NULL) are the baseline. Content equality is decided by the
 * stored `content_hash`.
 *
 * @export
 * @class SubmissionFeatureReconciliationRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureReconciliationRepository extends BaseRepository {
  /**
   * Delete any reconciliation outcome records previously written for the upload.
   *
   * Called before re-classification so re-activation of the same upload is idempotent.
   * The journal trigger preserves the deleted rows' history.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async deleteReconciliationRecordsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_upload_feature_reconciliation
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Classify the upload's pending features against the submission's published live
   * features and write one durable outcome record per reconciliation key.
   *
   * Outcomes:
   * - `conflict`: the incoming row has no source_id, or more than one incoming row shares
   *   the key, or more than one published baseline row shares the key (defensive; one
   *   outcome row is written per conflicted key and the key is not activated).
   * - `new`: no published baseline row exists for the key.
   * - `unchanged`: the baseline content_hash is present and equals the incoming
   *   content_hash. The outcome points at the baseline row, which remains published.
   * - `superseded`: the content differs (a NULL baseline hash always compares as
   *   changed). The outcome records the baseline row as the superseded predecessor.
   *
   * Already-published rows of the upload are excluded from the input, which makes
   * re-approval of an already-activated upload a no-op.
   *
   * Returns the per-outcome tally (aggregated in SQL) as raw `(outcome, count)` rows;
   * the service assembles them into a keyed counts object.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @param {number} submissionId The submission the upload belongs to.
   * @returns {Promise<ReconciliationOutcomeCount[]>} One row per distinct outcome written.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async insertReconciliationRecordsFromClassification(
    submissionUploadId: string,
    submissionId: number
  ): Promise<ReconciliationOutcomeCount[]> {
    const sqlStatement = SQL`
      WITH incoming AS (
        SELECT
          sf.submission_feature_id,
          sf.feature_type_id,
          sf.source_id,
          sf.content_hash,
          COUNT(*) OVER (PARTITION BY sf.feature_type_id, sf.source_id) AS key_count
        FROM submission_feature sf
        WHERE sf.submission_upload_id = ${submissionUploadId}::uuid
          AND sf.record_end_date IS NULL
          AND sf.record_effective_date IS NULL
      ),
      baseline AS (
        SELECT
          b.submission_feature_id,
          b.feature_type_id,
          b.source_id,
          b.content_hash,
          COUNT(*) OVER (PARTITION BY b.feature_type_id, b.source_id) AS key_count
        FROM submission_feature b
        WHERE b.submission_id = ${submissionId}
          AND b.record_end_date IS NULL
          AND b.record_effective_date IS NOT NULL
          AND b.source_id IS NOT NULL
      ),
      classified AS (
        SELECT
          i.feature_type_id,
          i.source_id,
          i.submission_feature_id AS incoming_submission_feature_id,
          b.submission_feature_id AS baseline_submission_feature_id,
          CASE
            WHEN i.source_id IS NULL OR i.key_count > 1 OR b.key_count > 1 THEN 'conflict'
            WHEN b.submission_feature_id IS NULL THEN 'new'
            WHEN b.content_hash IS NOT NULL AND b.content_hash = i.content_hash THEN 'unchanged'
            ELSE 'superseded'
          END AS outcome
        FROM incoming i
        LEFT JOIN baseline b
          ON b.feature_type_id = i.feature_type_id
         AND b.source_id = i.source_id
      ),
      deduplicated AS (
        SELECT DISTINCT ON (feature_type_id, source_id)
          feature_type_id,
          source_id,
          incoming_submission_feature_id,
          baseline_submission_feature_id,
          outcome
        FROM classified
        ORDER BY feature_type_id, source_id, incoming_submission_feature_id
      ),
      inserted AS (
        INSERT INTO submission_upload_feature_reconciliation (
          submission_upload_id,
          feature_type_id,
          source_id,
          outcome,
          submission_feature_id,
          previous_submission_feature_id
        )
        SELECT
          ${submissionUploadId}::uuid,
          d.feature_type_id,
          d.source_id,
          d.outcome::submission_feature_reconciliation_outcome,
          CASE
            WHEN d.outcome = 'conflict' THEN NULL
            WHEN d.outcome = 'unchanged' THEN d.baseline_submission_feature_id
            ELSE d.incoming_submission_feature_id
          END,
          CASE
            WHEN d.outcome = 'superseded' THEN d.baseline_submission_feature_id
          END
        FROM deduplicated d
        RETURNING outcome
      )
      SELECT outcome, COUNT(*)::integer AS count
      FROM inserted
      GROUP BY outcome;
    `;

    const response = await this.connection.sql(
      sqlStatement,
      z.object({ outcome: SubmissionFeatureReconciliationOutcome, count: z.number() })
    );

    return response.rows;
  }

  /**
   * Soft-end the published baseline rows superseded by this upload.
   *
   * Only the currently live predecessor recorded on each `superseded` outcome is ended;
   * historical rows are untouched. Must run before {@link publishIncomingRows} so the
   * one-published-row-per-key unique index is satisfied at every statement boundary.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of rows soft-ended.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async endSupersededBaselineRows(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_feature sf
      SET record_end_date = now()
      FROM submission_upload_feature_reconciliation r
      WHERE r.submission_upload_id = ${submissionUploadId}::uuid
        AND r.outcome = 'superseded'
        AND sf.submission_feature_id = r.previous_submission_feature_id
        AND sf.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Soft-end the upload's pending rows for `unchanged` keys.
   *
   * The published baseline row remains the live version; the upload's duplicate pending
   * row is ended without ever being published. The reconciliation record still reports
   * that the feature appeared in the upload.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of rows soft-ended.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async endUnchangedIncomingRows(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_feature sf
      SET record_end_date = now()
      FROM submission_upload_feature_reconciliation r
      WHERE r.submission_upload_id = ${submissionUploadId}::uuid
        AND r.outcome = 'unchanged'
        AND sf.submission_upload_id = ${submissionUploadId}::uuid
        AND sf.feature_type_id = r.feature_type_id
        AND sf.source_id = r.source_id
        AND sf.record_end_date IS NULL
        AND sf.record_effective_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Soft-end the upload's pending rows for `conflict` keys.
   *
   * Conflicted features are never published; ending their pending rows keeps the
   * lifecycle consistent with `unchanged` duplicates instead of leaving live-pending
   * rows behind indefinitely. The reconciliation record preserves the conflict outcome.
   * `IS NOT DISTINCT FROM` matches the NULL-source_id conflict class (Postgres equality
   * never matches NULLs).
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of rows soft-ended.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async endConflictIncomingRows(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_feature sf
      SET record_end_date = now()
      FROM submission_upload_feature_reconciliation r
      WHERE r.submission_upload_id = ${submissionUploadId}::uuid
        AND r.outcome = 'conflict'
        AND sf.submission_upload_id = ${submissionUploadId}::uuid
        AND sf.feature_type_id = r.feature_type_id
        AND sf.source_id IS NOT DISTINCT FROM r.source_id
        AND sf.record_end_date IS NULL
        AND sf.record_effective_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Publish the upload's pending rows for `new` and `superseded` outcomes.
   *
   * Must run after {@link endSupersededBaselineRows}: the partial unique index enforcing
   * one published row per reconciliation key is checked per statement, so predecessors
   * must be ended before their replacements are published.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of rows published.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async publishIncomingRows(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      UPDATE submission_feature sf
      SET record_effective_date = now()
      FROM submission_upload_feature_reconciliation r
      WHERE r.submission_upload_id = ${submissionUploadId}::uuid
        AND r.outcome IN ('new', 'superseded')
        AND sf.submission_feature_id = r.submission_feature_id
        AND sf.record_end_date IS NULL
        AND sf.record_effective_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Count the upload's live pending rows that share a `(feature_type_id, source_id)` key.
   *
   * Duplicate keys are normally blocked at the index stage; this is the defensive
   * activation-time guard. Any non-zero count aborts activation.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of pending rows involved in duplicate keys.
   * @memberof SubmissionFeatureReconciliationRepository
   */
  async getPendingDuplicateKeyRowCount(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      SELECT COALESCE(SUM(duplicate_count), 0)::integer AS duplicate_row_count
      FROM (
        SELECT COUNT(*) AS duplicate_count
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_end_date IS NULL
          AND record_effective_date IS NULL
          AND source_id IS NOT NULL
        GROUP BY feature_type_id, source_id
        HAVING COUNT(*) > 1
      ) AS duplicates;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ duplicate_row_count: z.number() }));
    return response.rows[0]?.duplicate_row_count ?? 0;
  }
}
