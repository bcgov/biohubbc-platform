import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { isEffectivelySecured, isSubmissionFeatureActive } from './sql-fragments';
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
   * Un-publish the upload's live features by clearing record_effective_date.
   *
   * Used when an upload is denied or returned to the submitted state: its live rows go
   * back to pending (invisible to search) and can be re-classified at a later approval.
   * `record_end_date` is never cleared — rows ended by reconciliation (superseded
   * predecessors, unchanged duplicates) stay ended, and resurrecting them could violate
   * the one-published-row-per-key unique index.
   *
   * A no-op for uploads whose rows are already pending (e.g. denying a never-approved
   * upload), so a zero row count is a valid result.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of rows un-published.
   * @memberof SubmissionFeatureRepository
   */
  async unpublishLiveSubmissionFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<number> {
    const sqlStatement = SQL`
      UPDATE
        submission_feature
      SET
        record_effective_date = NULL
      WHERE
        submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL
        AND record_effective_date IS NOT NULL
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    return response.rowCount ?? 0;
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
