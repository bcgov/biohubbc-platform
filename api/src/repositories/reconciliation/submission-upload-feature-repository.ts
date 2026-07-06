import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { ReconciliationCountsResult } from '../../models/reconciliation';
import {
  CreateSubmissionUploadFeature,
  SubmissionUploadFeature,
  SubmissionUploadFeaturesStaleResult,
  UpdateSubmissionUploadFeature
} from '../../models/submission-upload-feature';
import { BaseRepository } from '../base-repository';

/**
 * Persists feature classifications and promotions for a submission upload.
 *
 * @export
 * @class SubmissionUploadFeatureRepository
 * @extends {BaseRepository}
 */
export class SubmissionUploadFeatureRepository extends BaseRepository {
  /**
   * Insert an immutable parsed submission upload feature.
   *
   * @param {CreateSubmissionUploadFeature} data Submitted feature fields.
   * @returns {Promise<SubmissionUploadFeature>} The inserted upload feature.
   * @memberof SubmissionUploadFeatureRepository
   */
  async insertSubmissionUploadFeature(data: CreateSubmissionUploadFeature): Promise<SubmissionUploadFeature> {
    const sql = SQL`
      INSERT INTO submission_upload_feature (
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id
      ) VALUES (
        ${data.submission_upload_id}::uuid,
        ${data.source_id},
        ${data.feature_type_id},
        ${JSON.stringify(data.data)}::jsonb,
        ${data.data_byte_size},
        ${data.content_hash},
        ${data.universal_id}
      )
      RETURNING
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        submission_feature_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        reconciliation,
        metadata;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadFeature);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission upload feature', [
        'SubmissionUploadFeatureRepository->insertSubmissionUploadFeature',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission upload feature by its primary key.
   *
   * @param {string} submissionUploadFeatureId Submission upload feature identifier.
   * @returns {Promise<SubmissionUploadFeature>} The matching upload feature.
   * @memberof SubmissionUploadFeatureRepository
   */
  async getSubmissionUploadFeature(submissionUploadFeatureId: string): Promise<SubmissionUploadFeature> {
    const sql = SQL`
      SELECT
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        submission_feature_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        reconciliation,
        metadata
      FROM submission_upload_feature
      WHERE submission_upload_feature_id = ${submissionUploadFeatureId}::uuid;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadFeature);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload feature not found', [
        'SubmissionUploadFeatureRepository->getSubmissionUploadFeature',
        { submissionUploadFeatureId }
      ]);
    }
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadFeatureRepository->getSubmissionUploadFeature',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all retained features belonging to a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadFeature[]>} Upload features in identifier order.
   * @memberof SubmissionUploadFeatureRepository
   */
  async getSubmissionUploadFeaturesForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionUploadFeature[]> {
    const sql = SQL`
      SELECT
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        submission_feature_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        reconciliation,
        metadata
      FROM submission_upload_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY submission_upload_feature_id;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadFeature);

    return response.rows;
  }

  /**
   * Update only the derived reconciliation fields for an upload feature.
   *
   * The immutable submitted content is intentionally excluded from this operation.
   *
   * @param {string} submissionUploadFeatureId Submission upload feature identifier.
   * @param {UpdateSubmissionUploadFeature} data Derived reconciliation fields to update.
   * @returns {Promise<SubmissionUploadFeature>} The updated upload feature.
   * @memberof SubmissionUploadFeatureRepository
   */
  async updateSubmissionUploadFeature(
    submissionUploadFeatureId: string,
    data: UpdateSubmissionUploadFeature
  ): Promise<SubmissionUploadFeature> {
    const updateData: UpdateSubmissionUploadFeature = {};

    if (data.reconciliation !== undefined) {
      updateData.reconciliation = data.reconciliation;
    }

    if (data.submission_feature_id !== undefined) {
      updateData.submission_feature_id = data.submission_feature_id;
    }

    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiExecuteSQLError('No submission upload feature fields to update', [
        'SubmissionUploadFeatureRepository->updateSubmissionUploadFeature'
      ]);
    }

    const knex = getKnex();
    const query = knex('submission_upload_feature')
      .where('submission_upload_feature_id', submissionUploadFeatureId)
      .update(updateData)
      .returning([
        'submission_upload_feature_id',
        'submission_upload_id',
        'source_id',
        'submission_feature_id',
        'feature_type_id',
        'data',
        'data_byte_size',
        'content_hash',
        'universal_id',
        'reconciliation',
        'metadata'
      ]);

    const response = await this.connection.knex(query, SubmissionUploadFeature);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload feature not found', [
        'SubmissionUploadFeatureRepository->updateSubmissionUploadFeature',
        { submissionUploadFeatureId }
      ]);
    }
    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadFeatureRepository->updateSubmissionUploadFeature',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Classify every retained upload feature against the current active submission state.
   * Duplicate or source-less incoming rows are retained and classified as conflicts.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {number} submissionId Submission identifier forming the baseline scope.
   * The same statement groups the updated rows and persists the complete summary.
   *
   * @returns {Promise<ReconciliationCountsResult>} Persisted counts grouped by classification.
   * @memberof SubmissionUploadFeatureRepository
   */
  async updateSubmissionUploadFeaturesWithReconciliation(
    submissionUploadId: string,
    submissionId: number
  ): Promise<ReconciliationCountsResult> {
    const response = await this.connection.sql(
      SQL`
        WITH incoming AS (
          SELECT
            staged.submission_upload_feature_id,
            staged.feature_type_id,
            staged.source_id,
            staged.content_hash,
            COUNT(*) OVER (PARTITION BY staged.source_id) AS incoming_source_count
          FROM submission_upload_feature staged
          WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
        ),
        baseline AS (
          SELECT DISTINCT ON (feature.feature_type_id, feature.source_id)
            feature.submission_feature_id,
            feature.feature_type_id,
            feature.source_id,
            feature.content_hash
          FROM (
            SELECT DISTINCT feature_type_id, source_id
            FROM incoming
            WHERE source_id IS NOT NULL
              AND incoming_source_count = 1
          ) incoming_key
          JOIN submission_feature feature
            ON feature.feature_type_id = incoming_key.feature_type_id
           AND feature.source_id = incoming_key.source_id
          WHERE feature.submission_id = ${submissionId}
            AND feature.record_effective_date <= now()
            AND (feature.record_end_date IS NULL OR now() < feature.record_end_date)
          ORDER BY
            feature.feature_type_id,
            feature.source_id,
            (feature.content_hash IS NOT NULL) DESC,
            feature.record_effective_date DESC,
            feature.submission_feature_id DESC
        ),
        classified AS (
          SELECT
            incoming.submission_upload_feature_id,
            CASE
              WHEN baseline.submission_feature_id IS NOT NULL
                AND incoming.source_id IS NOT NULL
                AND incoming.incoming_source_count = 1
                AND baseline.content_hash IS NOT NULL
                AND baseline.content_hash = incoming.content_hash
                THEN baseline.submission_feature_id
              ELSE NULL
            END AS submission_feature_id,
            CASE
              WHEN incoming.source_id IS NULL THEN 'conflict'
              WHEN incoming.incoming_source_count > 1 THEN 'conflict'
              WHEN baseline.submission_feature_id IS NULL THEN 'new'
              WHEN baseline.content_hash IS NOT NULL AND baseline.content_hash = incoming.content_hash THEN 'unchanged'
              ELSE 'superseded'
            END AS reconciliation,
            CASE
              WHEN incoming.source_id IS NULL THEN jsonb_build_object('reason', 'missing_source_id')
              WHEN incoming.incoming_source_count > 1 THEN jsonb_build_object('reason', 'duplicate_source_id')
              ELSE NULL
            END AS metadata
          FROM incoming
          LEFT JOIN baseline
            ON baseline.feature_type_id = incoming.feature_type_id
           AND baseline.source_id = incoming.source_id
        ),
        updated AS (
          UPDATE submission_upload_feature staged
          SET reconciliation = classified.reconciliation::submission_feature_reconciliation_type,
              submission_feature_id = classified.submission_feature_id,
              metadata = classified.metadata
          FROM classified
          WHERE staged.submission_upload_feature_id = classified.submission_upload_feature_id
          RETURNING staged.reconciliation
        ),
        counts AS (
          SELECT
            values.reconciliation,
            COUNT(updated.reconciliation)::integer AS count
          FROM unnest(enum_range(NULL::submission_feature_reconciliation_type)) AS values(reconciliation)
          LEFT JOIN updated USING (reconciliation)
          GROUP BY values.reconciliation
        ),
        persisted AS (
          INSERT INTO submission_upload_reconciliation (
            submission_upload_id,
            reconciliation,
            count
          )
          SELECT
            ${submissionUploadId}::uuid,
            counts.reconciliation,
            counts.count
          FROM counts
          ON CONFLICT (submission_upload_id, reconciliation)
          DO UPDATE SET count = EXCLUDED.count
          RETURNING reconciliation, count
        )
        SELECT jsonb_build_object(
          'new', COALESCE(MAX(persisted.count) FILTER (WHERE persisted.reconciliation = 'new'), 0),
          'unchanged', COALESCE(MAX(persisted.count) FILTER (WHERE persisted.reconciliation = 'unchanged'), 0),
          'superseded', COALESCE(MAX(persisted.count) FILTER (WHERE persisted.reconciliation = 'superseded'), 0),
          'conflict', COALESCE(MAX(persisted.count) FILTER (WHERE persisted.reconciliation = 'conflict'), 0)
        ) AS reconciliation
        FROM persisted;
      `,
      ReconciliationCountsResult
    );

    return response.rows[0];
  }

  /**
   * Return whether an upload's prepared `unchanged` classification is stale.
   *
   * An `unchanged` row is valid only while its recorded target feature remains active
   * with the same content hash observed during reconciliation. The result is stale
   * when that exact feature is now absent, ended, or replaced by another upload. The
   * caller holds the submission active-state lock so this comparison cannot change
   * mid-check.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadFeaturesStaleResult>} SQL result containing the stale flag.
   */
  async isSubmissionUploadFeaturesStale(submissionUploadId: string): Promise<SubmissionUploadFeaturesStaleResult> {
    const response = await this.connection.sql(
      SQL`
        SELECT EXISTS (
          SELECT 1
          FROM submission_upload_feature staged
          WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
            AND staged.reconciliation = 'unchanged'
            AND NOT EXISTS (
              SELECT 1
              FROM submission_feature active_feature
              WHERE active_feature.submission_feature_id = staged.submission_feature_id
                AND active_feature.record_effective_date <= now()
                AND (active_feature.record_end_date IS NULL OR now() < active_feature.record_end_date)
                AND active_feature.content_hash = staged.content_hash
            )
        ) AS stale;
      `,
      SubmissionUploadFeaturesStaleResult
    );

    return response.rows[0];
  }

  /**
   * Link changed retained upload features to the pending submission features created from them.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>}
   */
  async updateSubmissionFeatureIdsForPromotedFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    await this.connection.sql(SQL`
      UPDATE submission_upload_feature staged
      SET submission_feature_id = feature.submission_feature_id
      FROM submission_feature feature
      WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
        AND staged.reconciliation IN ('new', 'superseded')
        AND feature.submission_upload_feature_id = staged.submission_upload_feature_id
        AND feature.record_effective_date IS NULL
        AND feature.record_end_date IS NULL;
    `);
  }
}
