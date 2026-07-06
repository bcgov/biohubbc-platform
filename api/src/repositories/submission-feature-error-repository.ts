import SQL from 'sql-template-strings';
import { BaseRepository } from './base-repository';

/**
 * Repository for submission_feature_error records.
 *
 * @export
 * @class SubmissionFeatureErrorRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureErrorRepository extends BaseRepository {
  /**
   * Delete reconciliation errors for a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureErrorRepository
   */
  async deleteSubmissionFeatureErrorsForSubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature_error
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND error_code IN ('RECONCILIATION_CONFLICT', 'DUPLICATE_FEATURE_SOURCE_ID');
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Insert a submission feature error summarizing staging reconciliation conflicts.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureErrorRepository
   */
  async insertSubmissionFeatureErrorForSubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      WITH deleted_errors AS (
        DELETE FROM submission_feature_error
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND error_code IN ('RECONCILIATION_CONFLICT', 'DUPLICATE_FEATURE_SOURCE_ID')
        RETURNING 1
      ),
      conflict_rows AS (
        SELECT
          staged.submission_upload_id,
          staged.source_id,
          staged.metadata->>'reason' AS reason
        FROM submission_upload_feature staged
        WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
          AND staged.reconciliation = 'conflict'
      ),
      error_rows AS (
        SELECT
          ${submissionUploadId}::uuid AS submission_upload_id,
          NULL::integer AS feature_type_property_id,
          NULL::text AS property_name,
          'RECONCILIATION_CONFLICT' AS error_code,
          'One or more staged features could not be reconciled safely' AS error_message,
          COUNT(*)::integer AS count,
          jsonb_build_object(
            'reasons',
            COALESCE(jsonb_agg(DISTINCT reason) FILTER (WHERE reason IS NOT NULL), '[]'::jsonb)
          ) AS details
        FROM conflict_rows
        HAVING COUNT(*) > 0

        UNION ALL

        SELECT
          submission_upload_id,
          NULL::integer AS feature_type_property_id,
          NULL::text AS property_name,
          'DUPLICATE_FEATURE_SOURCE_ID' AS error_code,
          'Multiple retained upload feature rows share the same source_id within this upload' AS error_message,
          COUNT(*)::integer AS count,
          jsonb_build_object('source_id', source_id) AS details
        FROM conflict_rows
        WHERE reason = 'duplicate_source_id'
        GROUP BY submission_upload_id, source_id
      )
      INSERT INTO submission_feature_error (
        submission_upload_id,
        feature_type_property_id,
        property_name,
        error_code,
        error_message,
        count,
        details
      )
      SELECT
        submission_upload_id,
        feature_type_property_id,
        property_name,
        error_code,
        error_message,
        count,
        details
      FROM error_rows;
    `;

    await this.connection.sql(sqlStatement);
  }
}
