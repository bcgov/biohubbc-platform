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
        AND error_code = 'RECONCILIATION_CONFLICT';
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
        ${submissionUploadId}::uuid,
        NULL,
        NULL,
        'RECONCILIATION_CONFLICT',
        'One or more staged features could not be reconciled safely',
        COUNT(*)::integer,
        jsonb_build_object(
          'reasons',
          COALESCE(jsonb_agg(DISTINCT staged.metadata->>'reason'), '[]'::jsonb)
        )
      FROM submission_upload_feature staged
      WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
        AND staged.reconciliation = 'conflict'
      HAVING COUNT(*) > 0;
    `;

    await this.connection.sql(sqlStatement);
  }
}
