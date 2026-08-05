import SQL from 'sql-template-strings';
import { z } from 'zod';
import { FeatureType, FeatureTypeWithProperties } from '../../models/feature-type';
import { BaseRepository } from '../base-repository';
import { isSubmissionFeatureActive } from '../sql-fragments';

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
   * @returns {Promise<FeatureType[]>}
   * @memberof FeatureIngestionRepository
   */
  async getActiveFeatureTypeMap(): Promise<FeatureType[]> {
    const sqlStatement = SQL`
      SELECT
        feature_type_id,
        name,
        display_name,
        description
      FROM
        feature_type
      WHERE
        record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, FeatureType);

    return response.rows;
  }

  /**
   * Get feature type name/id mappings used to ingest tarball features.
   *
   * Retired feature types remain ingestible so the Blueprint selected for the
   * upload can determine whether their features and properties are valid. When
   * multiple historical rows share a name, prefer the active row, otherwise the
   * most recently retired row; the tarball format contains only the type name.
   *
   * @returns {Promise<FeatureType[]>}
   * @memberof FeatureIngestionRepository
   */
  async getKnownFeatureTypeMap(): Promise<FeatureType[]> {
    const sqlStatement = SQL`
      SELECT DISTINCT ON (name)
        feature_type_id,
        name,
        display_name,
        description
      FROM
        feature_type
      ORDER BY
        name,
        record_end_date DESC NULLS FIRST,
        feature_type_id DESC;
    `;

    const response = await this.connection.sql(sqlStatement, FeatureType);

    return response.rows;
  }

  /**
   * Bulk insert raw features into the retained submission upload feature table.
   *
   * @param {Array<{
   *   submissionUploadId: string;
   *   sourceId: string;
   *   featureTypeId: number;
   *   data: unknown;
   *   dataByteSize: number;
   *   contentHash: string;
   *   universalId?: string;
   * }>} records
   * @returns {Promise<number>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionUploadFeatures(
    records: Array<{
      submissionUploadId: string;
      sourceId: string;
      featureTypeId: number;
      data: unknown;
      dataByteSize: number;
      contentHash: string;
      universalId?: string;
    }>
  ): Promise<number> {
    if (!records.length) {
      return 0;
    }

    const submissionUploadIds = records.map((record) => record.submissionUploadId);
    const sourceIds = records.map((record) => record.sourceId);
    const featureTypeIds = records.map((record) => record.featureTypeId);
    const dataValues = records.map((record) => JSON.stringify(record.data));
    const dataByteSizes = records.map((record) => record.dataByteSize);
    const contentHashes = records.map((record) => record.contentHash);
    const universalIds = records.map((record) => record.universalId ?? null);

    const sqlStatement = SQL`
      INSERT INTO submission_upload_feature (
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id
      )
      SELECT
        staged.submission_upload_id,
        staged.source_id,
        staged.feature_type_id,
        parsed.data,
        staged.data_byte_size,
        staged.content_hash,
        staged.universal_id
      FROM unnest(
        ${submissionUploadIds}::uuid[],
        ${sourceIds}::text[],
        ${featureTypeIds}::integer[],
        ${dataValues}::text[],
        ${dataByteSizes}::bigint[],
        ${contentHashes}::text[],
        ${universalIds}::text[]
      ) AS staged(
        submission_upload_id,
        source_id,
        feature_type_id,
        data_text,
        data_byte_size,
        content_hash,
        universal_id
      )
      CROSS JOIN LATERAL (SELECT staged.data_text::jsonb AS data) parsed;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Delete raw staged features scoped to a specific upload attempt.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @returns {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async deleteSubmissionUploadFeaturesForSubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_upload_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Return whether retained upload features have already produced submission_feature rows.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @returns {Promise<boolean>} True when promoted rows reference this upload's retained features.
   * @memberof FeatureIngestionRepository
   */
  async hasSubmissionFeaturesForSubmissionUploadId(submissionUploadId: string): Promise<boolean> {
    const sqlStatement = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM submission_feature feature
        JOIN submission_upload_feature staged
          ON staged.submission_upload_feature_id = feature.submission_upload_feature_id
        WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
      ) AS exists;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ exists: z.boolean() }));
    return response.rows[0]?.exists ?? false;
  }

  /**
   * Resolve parent feature references for the upload's staged feature scope.
   *
   * Shallow ingestion stores raw feature payloads first. The indexing stage then
   * resolves `data.parent` source identifiers to canonical `submission_feature_id`
   * values after all rows for the upload have been inserted.
   *
   * Resolution prefers a pending row produced by the current upload, falling back to
   * the submission's published live rows. The source scope follows retained staging
   * links so unchanged features owned by an earlier upload are repointed when their
   * logical parent is superseded. Ties resolve to the newest row for determinism.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @param {number} submissionId The submission the upload belongs to.
   * @returns {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async updateSubmissionFeatureParentsBySubmissionUploadId(
    submissionUploadId: string,
    submissionId: number
  ): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature AS child
      SET parent_submission_feature_id = (
        SELECT parent.submission_feature_id
        FROM submission_feature AS parent
        WHERE parent.submission_id = ${submissionId}
          AND parent.source_id = child.data->>'parent'
          AND (
            (
              parent.submission_upload_id = ${submissionUploadId}::uuid
              AND parent.record_effective_date IS NULL
              AND parent.record_end_date IS NULL
            )
            OR (`;
    sqlStatement.append(isSubmissionFeatureActive('parent'));
    sqlStatement.append(SQL`)
        )
        ORDER BY
          (parent.submission_upload_id = ${submissionUploadId}::uuid) DESC,
          parent.submission_feature_id DESC
        LIMIT 1
      )
      FROM submission_upload_feature staged
      WHERE staged.submission_upload_id = ${submissionUploadId}::uuid
        AND staged.submission_feature_id = child.submission_feature_id
        AND child.data->>'parent' IS NOT NULL
        AND (
          (child.record_effective_date IS NULL AND child.record_end_date IS NULL)
          OR (`);
    sqlStatement.append(isSubmissionFeatureActive('child'));
    sqlStatement.append(`)
        );`);

    await this.connection.sql(sqlStatement);
  }

  /**
   * Get feature type with its associated properties.
   * Returns null if the feature type does not exist.
   *
   * @param {string} name Feature type name.
   * @returns {Promise<FeatureTypeWithProperties | null>}
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
