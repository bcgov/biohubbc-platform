import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CountResult } from '../models/count';
import { SubmissionFeatureRevocationResult } from '../models/submission-feature';
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

  /**
   * Insert pending submission features from changed staging rows.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<CountResult>} Number of pending submission features inserted.
   * @memberof SubmissionFeatureRepository
   */
  async insertPendingSubmissionFeaturesForSubmissionUploadId(submissionUploadId: string): Promise<CountResult> {
    const sqlStatement = SQL`
      WITH inserted AS (
        INSERT INTO submission_feature (
          submission_id,
          submission_upload_id,
          parent_submission_feature_id,
          source_id,
          feature_type_id,
          data,
          data_byte_size,
          content_hash,
          universal_id,
          submission_upload_feature_id
        )
        SELECT
          upload.submission_id,
          staged.submission_upload_id,
          NULL,
          staged.source_id,
          staged.feature_type_id,
          staged.data,
          staged.data_byte_size,
          staged.content_hash,
          staged.universal_id,
          staged.submission_upload_feature_id
        FROM submission_upload_feature staged
        JOIN submission_upload upload USING (submission_upload_id)
        WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
          AND staged.reconciliation IN ('new', 'superseded')
        ON CONFLICT (submission_upload_id, feature_type_id, source_id)
          WHERE record_end_date IS NULL AND record_effective_date IS NULL AND source_id IS NOT NULL
        DO NOTHING
        RETURNING submission_feature_id
      )
      SELECT COUNT(*)::integer AS count
      FROM inserted;
    `;

    const response = await this.connection.sql(sqlStatement, CountResult);
    return response.rows[0];
  }

  /**
   * Deactivate active feature versions replaced by an upload's changed rows.
   *
   * The prepared reconciliation describes the baseline when the upload was
   * classified, but another upload may have been approved since then. Publication is
   * therefore last-approval-wins for every changed natural key (`new` or `superseded`).
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<CountResult>} Number of active submission features deactivated.
   * @memberof SubmissionFeatureRepository
   */
  async deactivateReplacedSubmissionFeaturesForSubmissionUploadId(submissionUploadId: string): Promise<CountResult> {
    const response = await this.connection.sql(
      SQL`
        WITH changed_features AS (
          SELECT
            upload.submission_id,
            staged.submission_upload_id,
            staged.feature_type_id,
            staged.source_id
          FROM submission_upload_feature staged
          JOIN submission_upload upload USING (submission_upload_id)
          WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
            AND staged.reconciliation IN ('new', 'superseded')
        ),
        ended AS (
          UPDATE submission_feature feature
          SET record_end_date = now()
          FROM changed_features changed
          WHERE feature.submission_id = changed.submission_id
            AND feature.submission_upload_id <> changed.submission_upload_id
            AND feature.feature_type_id = changed.feature_type_id
            AND feature.source_id = changed.source_id
            AND feature.record_effective_date <= now()
            AND (feature.record_end_date IS NULL OR now() < feature.record_end_date)
          RETURNING feature.submission_feature_id
        )
        SELECT COUNT(*)::integer AS count
        FROM ended;
      `,
      CountResult
    );

    return response.rows[0];
  }

  /**
   * Activate or reactivate promoted submission features for an upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<CountResult>} Number of submission features activated.
   * @memberof SubmissionFeatureRepository
   */
  async activateSubmissionFeaturesForSubmissionUploadId(submissionUploadId: string): Promise<CountResult> {
    const sqlStatement = SQL`
      WITH activated AS (
        UPDATE submission_feature feature
        SET record_effective_date = COALESCE(feature.record_effective_date, now()),
            record_end_date = NULL
        FROM submission_upload_feature staged
        JOIN submission_upload upload USING (submission_upload_id)
        WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
          AND staged.reconciliation IN ('new', 'superseded')
          AND feature.submission_upload_feature_id = staged.submission_upload_feature_id
          AND feature.submission_id = upload.submission_id
          AND (
            (feature.record_effective_date IS NULL AND feature.record_end_date IS NULL)
            OR feature.record_effective_date <= now()
          )
        RETURNING feature.submission_feature_id
      )
      SELECT COUNT(*)::integer AS count
      FROM activated;
    `;

    const response = await this.connection.sql(sqlStatement, CountResult);
    return response.rows[0];
  }

  /**
   * Count pending submission features prepared from an upload's changed staging rows.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<CountResult>} Number of pending prepared features.
   */
  async getPendingSubmissionFeatureCountForSubmissionUploadId(submissionUploadId: string): Promise<CountResult> {
    const response = await this.connection.sql(
      SQL`
        SELECT COUNT(*)::integer AS count
        FROM submission_upload_feature staged
        JOIN submission_feature feature
          ON feature.submission_upload_feature_id = staged.submission_upload_feature_id
         AND feature.record_effective_date IS NULL
         AND feature.record_end_date IS NULL
        WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
          AND staged.reconciliation IN ('new', 'superseded');
      `,
      CountResult
    );

    return response.rows[0];
  }

  /**
   * End the active features created by a revoked upload and restore their latest
   * eligible predecessors by reconciliation key.
   *
   * The upload is transaction provenance, not feature identity. The reconciliation
   * key `(submission_id, feature_type_id, source_id)` locates the newest previously
   * effective version whose upload remains approved. Features already superseded by
   * a later upload are not ended by this statement and therefore are not restored.
   * Parent relationships are submitted feature data and are never repointed here.
   *
   * @param {string} submissionUploadId Revoked submission upload identifier.
   * @returns {Promise<SubmissionFeatureRevocationResult>} Counts of ended and restored features.
   */
  async revokeSubmissionFeaturesForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionFeatureRevocationResult> {
    const response = await this.connection.sql(
      SQL`
      WITH revoked AS (
        UPDATE submission_feature feature
        SET record_end_date = now()
        WHERE feature.submission_upload_id = ${submissionUploadId}::uuid
          AND feature.record_effective_date <= now()
          AND (feature.record_end_date IS NULL OR now() < feature.record_end_date)
        RETURNING
          feature.submission_feature_id,
          feature.submission_id,
          feature.feature_type_id,
          feature.source_id
      ),
      predecessors AS (
        SELECT DISTINCT ON (revoked.submission_feature_id)
          revoked.submission_feature_id AS revoked_submission_feature_id,
          predecessor.submission_feature_id AS predecessor_submission_feature_id
        FROM revoked
        JOIN submission_feature predecessor
          ON predecessor.submission_id = revoked.submission_id
         AND predecessor.feature_type_id = revoked.feature_type_id
         AND predecessor.source_id = revoked.source_id
        WHERE revoked.source_id IS NOT NULL
          AND predecessor.submission_upload_id <> ${submissionUploadId}::uuid
          AND predecessor.record_effective_date <= now()
          AND predecessor.record_end_date <= now()
          AND (
            SELECT status::text
            FROM submission_upload_status review_status
            WHERE review_status.submission_upload_id = predecessor.submission_upload_id
            ORDER BY review_status.create_date DESC, review_status.submission_upload_status_id DESC
            LIMIT 1
          ) = 'approved'
        ORDER BY
          revoked.submission_feature_id,
          predecessor.record_end_date DESC,
          predecessor.submission_feature_id DESC
      ),
      restored AS (
        UPDATE submission_feature feature
        SET record_end_date = NULL
        FROM predecessors
        WHERE feature.submission_feature_id = predecessors.predecessor_submission_feature_id
        RETURNING feature.submission_feature_id
      )
      SELECT
        (SELECT COUNT(*)::integer FROM revoked) AS "revokedFeatureCount",
        (SELECT COUNT(*)::integer FROM restored) AS "restoredFeatureCount";
    `,
      SubmissionFeatureRevocationResult
    );

    return response.rows[0];
  }
}
