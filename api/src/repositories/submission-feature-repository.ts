import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CountResult } from '../models/count';
import { BaseRepository } from './base-repository';
import { isEffectivelySecured, isSubmissionFeatureActive } from './sql-fragments';
import { SubmissionFeature, SubmissionFeatureRecord } from './submission-repository';

/**
 * Repository class for submission-feature specific queries.
 *
 * @export
 * @class SubmissionFeatureRepository
 * @extends {BaseRepository}
 */
export class SubmissionFeatureRepository extends BaseRepository {
  /**
   * Count feature rows from an upload that have ever been activated.
   *
   * Historical and superseded rows remain included because a prior activation permanently makes the
   * owning upload immutable.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<number>} Number of upload-owned feature rows with an effective date.
   * @memberof SubmissionFeatureRepository
   */
  async getActivatedSubmissionFeatureCountBySubmissionUploadId(submissionUploadId: string): Promise<number> {
    const response = await this.connection.sql(
      SQL`
        SELECT COUNT(*)::integer AS count
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}::uuid
          AND record_effective_date IS NOT NULL;
      `,
      CountResult
    );

    return response.rows[0]?.count ?? 0;
  }

  /**
   * Count feature rows in a submission that have ever been activated.
   *
   * Only features belonging to active upload records are considered. Historical and superseded feature
   * rows remain included so bulk upload mutations cannot reverse previously published state.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<number>} Number of activated feature rows owned by active submission uploads.
   * @memberof SubmissionFeatureRepository
   */
  async getActivatedSubmissionFeatureCountBySubmissionId(submissionId: number): Promise<number> {
    const response = await this.connection.sql(
      SQL`
        SELECT COUNT(*)::integer AS count
        FROM submission_feature sf
        JOIN submission_upload su
          ON su.submission_upload_id = sf.submission_upload_id
         AND su.record_end_date IS NULL
        WHERE sf.submission_id = ${submissionId}
          AND sf.record_effective_date IS NOT NULL;
      `,
      CountResult
    );

    return response.rows[0]?.count ?? 0;
  }

  /**
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionUuid Submission feature UUID.
   * @returns {Promise<SubmissionFeatureRecord>} Active submission feature record matching the UUID.
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
   * `secured` is the effectively-secured state: the feature is secured when it or any ancestor
   * carries an active security rule, resolved through the precomputed closure ancestry. This
   * mirrors the read-path visibility check, so the detail page's secured badge agrees with search
   * results and with what actually hides the data.
   *
   * `security_reasons` are the distinct names of the security rules securing this feature directly
   * or via an ancestor. It is empty when the feature is not effectively secured. It can also be empty
   * while `secured` is true: in the fail-closed case the feature counts as secured because its closure
   * ancestry has not been built yet, so the securing rules cannot be resolved — the UI then reveals
   * only that the feature is secured and exposes no sensitive detail.
   *
   * Only active, non-end-dated security rows are counted, so draft or retired security never drives
   * the UI.
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
    `;
    // The security fragments are raw, zero-placeholder SQL and must be appended as text: interpolating
    // them into a SQL`` tag would bind them as parameter values rather than splice them as SQL.
    sqlStatement.append(`
        ${isEffectivelySecured('sf.submission_feature_id')} AS secured,
        COALESCE((
          SELECT ARRAY_REMOVE(ARRAY_AGG(DISTINCT sr.name ORDER BY sr.name), NULL)
          FROM submission_feature_closure c
          JOIN submission_feature_security sfs ON sfs.submission_feature_id = c.target_submission_feature_id
          JOIN submission_feature sf_sec ON sf_sec.submission_feature_id = c.target_submission_feature_id
          JOIN security_rule sr ON sr.security_rule_id = sfs.security_rule_id
          WHERE c.source_submission_feature_id = sf.submission_feature_id
            AND c.is_ancestor = true
            AND sfs.record_end_date IS NULL
            AND sfs.status = 'active'
            AND ${isSubmissionFeatureActive('sf_sec')}
        ), ARRAY[]::varchar[]) AS security_reasons
      FROM
        submission_feature sf
      JOIN
        feature_type ft ON ft.feature_type_id = sf.feature_type_id
      JOIN
        submission s ON s.submission_id = sf.submission_id
      WHERE
        sf.submission_feature_id =`);
    sqlStatement.append(SQL` ${submissionFeatureId}`);
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
}
