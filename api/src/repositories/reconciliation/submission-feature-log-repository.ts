import SQL from 'sql-template-strings';
import { BaseRepository } from '../base-repository';

/**
 * Repository for the append-only `submission_feature_log` table, which records terminal
 * submission_feature transitions: `superseded` (a changed version replaces a published
 * feature during reconciliation) and `removed` (reserved for a future workflow). New,
 * unchanged, and pending-row soft-ends are never logged. Rows are permanent; the unique
 * index on previous_submission_feature_id keeps version chains linear.
 *
 * @export
 * @class SubmissionFeatureLogRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureLogRepository extends BaseRepository {
  /**
   * Write one `superseded` log row per superseded reconciliation outcome of the upload,
   * linking each ended predecessor to its replacement and snapshotting both content hashes.
   *
   * Derived from `submission_upload_feature_reconciliation`, so an upload with no superseded
   * outcomes (including idempotent re-approval) inserts nothing. A predecessor cannot be
   * superseded twice — its record_end_date is never cleared — and `submission_feature_log_uk1`
   * is the backstop: a violation must abort the approval rather than be swallowed.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of log rows inserted.
   * @memberof SubmissionFeatureLogRepository
   */
  async insertSupersededLogRecordsFromReconciliation(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature_log (
        submission_id,
        submission_upload_id,
        feature_type_id,
        source_id,
        action,
        previous_submission_feature_id,
        new_submission_feature_id,
        previous_content_hash,
        new_content_hash
      )
      SELECT
        new_sf.submission_id,
        r.submission_upload_id,
        r.feature_type_id,
        r.source_id,
        'superseded'::submission_feature_log_action,
        r.previous_submission_feature_id,
        r.submission_feature_id,
        prev_sf.content_hash,
        new_sf.content_hash
      FROM submission_upload_feature_reconciliation r
      JOIN submission_feature prev_sf
        ON prev_sf.submission_feature_id = r.previous_submission_feature_id
      JOIN submission_feature new_sf
        ON new_sf.submission_feature_id = r.submission_feature_id
      WHERE r.submission_upload_id = ${submissionUploadId}::uuid
        AND r.outcome = 'superseded';
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }
}
