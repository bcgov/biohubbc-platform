import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { isSubmissionFeatureActive } from './sql-fragments';
import { RelatedSubmissionFeature, SubmissionFeature, SubmissionFeatureRecord } from './submission-repository';

/**
 * Repository class for submission-feature specific queries.
 *
 * @export
 * @class SubmissionFeatureRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureRepository extends BaseRepository {
  /**
   * Set record_effective_date for active features from a submission upload.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureRepository
   */
  async setRecordEffectiveDateBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_feature
      SET
        record_effective_date = now(),
        record_end_date = NULL
      WHERE
        submission_upload_id = ${submissionUploadId}
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to set submission feature record effective dates', [
        'SubmissionFeatureRepository->setRecordEffectiveDateBySubmissionUploadId',
        'rowCount was null, undefined, or 0'
      ]);
    }
  }

  /**
   * Set record_end_date for features from a rejected submission upload.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureRepository
   */
  async setRecordEndDateBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_feature
      SET
        record_end_date = now()
      WHERE
        submission_upload_id = ${submissionUploadId}
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to set submission feature record end dates', [
        'SubmissionFeatureRepository->setRecordEndDateBySubmissionUploadId',
        'rowCount was null, undefined, or 0'
      ]);
    }
  }

  /**
   * Clear publication and rejection dates for features from a submitted upload.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<void>}
   * @memberof SubmissionFeatureRepository
   */
  async unsetRecordDatesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_feature
      SET
        record_effective_date = NULL,
        record_end_date = NULL
      WHERE
        submission_upload_id = ${submissionUploadId}
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to unset submission feature record dates', [
        'SubmissionFeatureRepository->unsetRecordDatesBySubmissionUploadId',
        'rowCount was null, undefined, or 0'
      ]);
    }
  }

  /**
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionUuid
   * @returns {Promise<SubmissionFeatureRecord>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeatureByUuid(submissionUuid: string): Promise<SubmissionFeatureRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission_feature
      WHERE
        uuid = ${submissionUuid}
    `;
    sqlStatement.append(` AND ${isSubmissionFeatureActive('submission_feature')};`);

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission feature record', [
        'SubmissionFeatureRepository->getSubmissionFeatureByUuid',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission feature record by Id.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<SubmissionFeature>}
   * @memberof SubmissionFeatureRepository
   */
  async getSubmissionFeatureById(submissionFeatureId: number): Promise<SubmissionFeature> {
    const sqlStatement = SQL`
      SELECT
        sf.submission_feature_id,
        sf.uuid,
        sf.urn,
        sf.submission_id,
        sf.feature_type_id,
        sf.source_id,
        sf.data,
        ft.name as feature_type_name,
        ft.display_name as feature_type_display_name,
        s.name as submission_name,
        EXISTS (
          SELECT 1
          FROM submission_feature_security sfs
          WHERE sfs.submission_feature_id = sf.submission_feature_id
            AND sfs.record_end_date IS NULL
            AND sfs.status = 'active'
        ) AS secured
      FROM
        submission_feature sf
      JOIN
        feature_type ft ON ft.feature_type_id = sf.feature_type_id
      JOIN
        submission s ON s.submission_id = sf.submission_id
      WHERE
        sf.submission_feature_id = ${submissionFeatureId}
    `;
    sqlStatement.append(` AND ${isSubmissionFeatureActive('sf')};`);

    const response = await this.connection.sql(sqlStatement, SubmissionFeature);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get submission feature record', [
        'SubmissionFeatureRepository->getSubmissionFeatureById',
        `rowCount was ${response.rowCount}, expected rowCount === 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all related submission features with their type names.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<RelatedSubmissionFeature[]>}
   * @memberof SubmissionFeatureRepository
   */
  async getRelatedSubmissionFeatures(submissionFeatureId: number): Promise<RelatedSubmissionFeature[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT
        sf.submission_feature_id,
        ft.name as feature_type_name,
        ft.display_name as feature_type_display_name,
        sf.data
      FROM submission_feature sf
      JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
      WHERE sf.submission_feature_id IN (
        SELECT source_feature_id FROM submission_feature_feature
        WHERE target_feature_id = ${submissionFeatureId}
        UNION
        SELECT target_feature_id FROM submission_feature_feature
        WHERE source_feature_id = ${submissionFeatureId}
      )
    `;
    sqlStatement.append(` AND ${isSubmissionFeatureActive('sf')};`);

    const response = await this.connection.sql(sqlStatement, RelatedSubmissionFeature);
    return response.rows;
  }

}
