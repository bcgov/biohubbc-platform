import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { InsertSubmissionFeatureRecord } from '../../models/submission-feature';
import { BaseRepository } from '../base-repository';

const ActiveFeatureTypeRow = z.object({
  feature_type_id: z.number(),
  name: z.string()
});

export type ActiveFeatureTypeRow = z.infer<typeof ActiveFeatureTypeRow>;

/**
 * A repository class for ingestion-related data access.
 *
 * @export
 * @class FeatureIngestionRepository
 * @extends {BaseRepository}
 */
export class FeatureIngestionRepository extends BaseRepository {
  /**
   * Get active feature type name/id mapping.
   *
   * Repository methods should return row-shaped data; callers can project this
   * into domain-specific structures (for example, a `Map`) in the service layer.
   *
   * @returns {Promise<ActiveFeatureTypeRow[]>}
   * @memberof FeatureIngestionRepository
   */
  async getActiveFeatureTypeMap(): Promise<ActiveFeatureTypeRow[]> {
    const sqlStatement = SQL`
      SELECT
        feature_type_id,
        name
      FROM
        feature_type
      WHERE
        record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, ActiveFeatureTypeRow);

    return response.rows;
  }

  /**
   * Bulk insert submission feature rows with pre-resolved feature_type_id.
   *
   * @param {Array<{
   *   submissionId: number;
   *   submissionUploadId: string;
   *   sourceId: string;
   *   featureTypeId: number;
   *   data: unknown;
   *   dataByteSize: number;
   * }>} records
   * @return {Promise<number>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatureRecordsByTypeId(
    records: Array<{
      submissionId: number;
      submissionUploadId: string;
      sourceId: string;
      featureTypeId: number;
      data: unknown;
      dataByteSize: number;
    }>
  ): Promise<number> {
    if (!records.length) {
      return 0;
    }

    const submissionIds = records.map((record) => record.submissionId);
    const submissionUploadIds = records.map((record) => record.submissionUploadId);
    const sourceIds = records.map((record) => record.sourceId);
    const featureTypeIds = records.map((record) => record.featureTypeId);
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
        data_byte_size
      )
      SELECT
        staged.submission_id,
        staged.submission_upload_id,
        NULL,
        staged.source_id,
        staged.feature_type_id,
        parsed.data,
        staged.data_byte_size
      FROM unnest(
        ${submissionIds}::integer[],
        ${submissionUploadIds}::uuid[],
        ${sourceIds}::text[],
        ${featureTypeIds}::integer[],
        ${dataValues}::text[],
        ${dataByteSizes}::bigint[]
      ) AS staged(
        submission_id,
        submission_upload_id,
        source_id,
        feature_type_id,
        data_text,
        data_byte_size
      )
      CROSS JOIN LATERAL (SELECT staged.data_text::jsonb AS data) parsed;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Insert a new submission feature record.
   * Features belong to a submission (submission_id) but are produced by a specific
   * upload event (submission_upload_id). This distinction enables multi-upload-per-submission
   * (append, replace).
   *
   * @param {InsertSubmissionFeatureRecord} record The submission feature insert payload.
   * @return {*}  {Promise<{ submission_feature_id: number }>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatureRecord(
    record: InsertSubmissionFeatureRecord
  ): Promise<{ submission_feature_id: number }> {
    const {
      submissionId,
      submissionUploadId,
      parentSubmissionFeatureId,
      featureSourceId,
      featureTypeName,
      featureProperties,
      dataByteSizeBytes
    } = record;

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
        AND record_effective_date IS NULL
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Resolve parent feature references for rows produced by one upload.
   *
   * Shallow ingestion stores raw feature payloads first. The indexing stage then
   * resolves `data.parent` source identifiers to canonical `submission_feature_id`
   * values after all rows for the upload have been inserted.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async updateSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature AS child
      SET parent_submission_feature_id = parent.submission_feature_id
      FROM submission_feature AS parent
      WHERE child.submission_upload_id = ${submissionUploadId}
        AND parent.submission_upload_id = child.submission_upload_id
        AND parent.source_id = child.data->>'parent'
        AND child.data->>'parent' IS NOT NULL
        AND child.record_end_date IS NULL
        AND parent.record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Get feature type with its associated properties.
   * Returns null if the feature type does not exist.
   *
   * @param {string} name Feature type name.
   * @return {Promise<FeatureTypeWithProperties | null>}
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
        JSON_BUILD_OBJECT(
          'feature_type_id', ft.feature_type_id,
          'name', ft.name,
          'display_name', ft.display_name
        ) AS "feature_type",
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

    const response = await this.connection.sql(sqlStatement, FeatureTypeWithProperties);

    return response.rows[0] ?? null;
  }
}
