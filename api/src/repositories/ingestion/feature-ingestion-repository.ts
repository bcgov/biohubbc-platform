import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { FeatureTypeWithProperties, FeatureTypeWithPropertiesRow } from '../../models/feature-type';
import { BaseRepository } from '../base-repository';
import type { ISubmissionFeature } from '../submission-repository';

export interface SubmissionFeatureIngestionRecord {
  submissionId: number;
  submissionUploadId: string;
  sourceId: string;
  featureTypeName: string;
  data: Record<string, unknown>;
  dataByteSize: number;
}

/**
 * A repository class for ingestion-related data access.
 *
 * @export
 * @class FeatureIngestionRepository
 * @extends {BaseRepository}
 */
export class FeatureIngestionRepository extends BaseRepository {
  /**
   * Bulk insert submission feature rows (raw payload persisted in `data`).
   *
   * @param {Array<{
   *   submissionId: number;
   *   submissionUploadId: string;
   *   sourceId: string;
   *   featureTypeName: string;
   *   data: Record<string, unknown>;
   *   dataByteSize: number;
   * }>} records
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatureRecords(
    records: SubmissionFeatureIngestionRecord[]
  ): Promise<void> {
    if (!records.length) {
      return;
    }

    const submissionIds = records.map((record) => record.submissionId);
    const submissionUploadIds = records.map((record) => record.submissionUploadId);
    const sourceIds = records.map((record) => record.sourceId);
    const featureTypeNames = records.map((record) => record.featureTypeName);
    const dataValues = records.map((record) => JSON.stringify(record.data));
    const dataByteSizes = records.map((record) => record.dataByteSize);

    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        record_effective_date
      )
      SELECT
        staged.submission_id,
        staged.submission_upload_id,
        NULL,
        staged.source_id,
        ft.feature_type_id,
        parsed.data,
        staged.data_byte_size,
        now()
      FROM unnest(
        ${submissionIds}::integer[],
        ${submissionUploadIds}::uuid[],
        ${sourceIds}::text[],
        ${featureTypeNames}::text[],
        ${dataValues}::text[],
        ${dataByteSizes}::integer[]
      ) AS staged(
        submission_id,
        submission_upload_id,
        source_id,
        feature_type_name,
        data_text,
        data_byte_size
      )
      INNER JOIN feature_type ft ON ft.name = staged.feature_type_name
      CROSS JOIN LATERAL (SELECT staged.data_text::jsonb AS data) parsed;
    `;

    const response = await this.connection.sql(sqlStatement);
    if (response.rowCount !== records.length) {
      throw new ApiExecuteSQLError('Failed to bulk insert submission feature records', [
        'FeatureIngestionRepository->insertSubmissionFeatureRecords',
        `rowCount was ${response.rowCount ?? 'null'}, expected ${records.length}`
      ]);
    }
  }

  /**
   * Insert a new submission feature record.
   * Features belong to a submission (submission_id) but are produced by a specific
   * upload event (submission_upload_id). This distinction enables multi-upload-per-submission
   * (append, replace).
   *
   * @param {number} submissionId The ID of the submission.
   * @param {string} submissionUploadId The submission_upload_id that produced these features.
   * @param {(number | null)} parentSubmissionFeatureId The ID of the parent submission feature, or null.
   * @param {(string | null)} featureSourceId The source ID of the feature, or null.
   * @param {string} featureTypeName The name of the feature type.
   * @param {ISubmissionFeature['properties']} featureProperties The properties of the submission feature.
   * @param {number} dataByteSizeBytes The byte size of the data.
   * @return {*}  {Promise<{ submission_feature_id: number }>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatureRecord(
    submissionId: number,
    submissionUploadId: string,
    parentSubmissionFeatureId: number | null,
    featureSourceId: string | null,
    featureTypeName: string,
    featureProperties: ISubmissionFeature['properties'],
    dataByteSizeBytes: number
  ): Promise<{ submission_feature_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        record_effective_date
      ) VALUES (
        ${submissionId},
        ${submissionUploadId},
        ${parentSubmissionFeatureId},
        ${featureSourceId},
        (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName}),
        ${featureProperties},
        ${dataByteSizeBytes},
        now()
      )
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ submission_feature_id: z.number() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission feature record', [
        'FeatureIngestionRepository->insertSubmissionFeatureRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update the parent reference for a submission feature.
   *
   * @param {number} submissionFeatureId The ID of the feature to update.
   * @param {number} parentSubmissionFeatureId The ID of the parent feature.
   * @return {*}  {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async updateSubmissionFeatureParent(submissionFeatureId: number, parentSubmissionFeatureId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature
      SET parent_submission_feature_id = ${parentSubmissionFeatureId}
      WHERE submission_feature_id = ${submissionFeatureId};
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft-delete features scoped to a specific upload event.
   * Multiple uploads produce features under the same submission_id;
   * re-ingesting one upload must not affect features from other uploads.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature
      SET record_end_date = NOW()
      WHERE submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete all submission features for a submission (soft delete).
   * Used for idempotency - allows job retries to start fresh.
   *
   * @param {number} submissionId The submission ID.
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async deleteSubmissionFeatures(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature
      SET record_end_date = NOW()
      WHERE submission_id = ${submissionId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Get feature type with its associated properties.
   * Returns null if the feature type does not exist.
   * Returns empty properties array if the feature type exists but has no properties.
   *
   * @param {string} name - The feature type name to look up
   * @return {Promise<FeatureTypeWithProperties | null>} The feature type with properties, or null if not found
   * @memberof FeatureIngestionRepository
   */
  async findFeatureTypeWithProperties(name: string): Promise<FeatureTypeWithProperties | null> {
    const sqlStatement = SQL`
      WITH feature_type_cte AS (
        SELECT
          ft.feature_type_id,
          ft.name,
          ft.display_name
        FROM feature_type ft
        WHERE
          ft.name = ${name}
          AND ft.record_end_date IS NULL
      ),
      properties_cte AS (
        SELECT
          ftp.feature_type_id,
          ftp.feature_type_property_id,
          fp.name,
          fp.display_name,
          fp.description,
          fpt.name AS type_name,
          ftp.required_value,
          fp.calculated_value
        FROM feature_type_property ftp
        JOIN feature_property fp
          ON ftp.feature_property_id = fp.feature_property_id
          AND fp.record_end_date IS NULL
        JOIN feature_property_type fpt
          ON fp.feature_property_type_id = fpt.feature_property_type_id
          AND fpt.record_end_date IS NULL
        WHERE
          ftp.record_end_date IS NULL
      )
      SELECT
        ft.feature_type_id,
        ft.name,
        ft.display_name,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'feature_type_property_id', p.feature_type_property_id,
              'name', p.name,
              'display_name', p.display_name,
              'description', p.description,
              'type_name', p.type_name,
              'required_value', p.required_value,
              'calculated_value', p.calculated_value
            )
          ) FILTER (WHERE p.name IS NOT NULL),
          '[]'
        ) AS properties
      FROM feature_type_cte ft
      LEFT JOIN properties_cte p
        ON ft.feature_type_id = p.feature_type_id
      GROUP BY
        ft.feature_type_id,
        ft.name,
        ft.display_name;
    `;

    const response = await this.connection.sql(sqlStatement, FeatureTypeWithPropertiesRow);

    if (response.rowCount === 0) {
      return null;
    }

    const row = response.rows[0];

    return {
      featureType: {
        feature_type_id: row.feature_type_id,
        name: row.name,
        display_name: row.display_name
      },
      properties: row.properties
    };
  }
}
