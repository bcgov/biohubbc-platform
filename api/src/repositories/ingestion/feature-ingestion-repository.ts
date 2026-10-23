import SQL from 'sql-template-strings';
import { FeatureType } from '../../models/feature-type';
import { SubmissionFeatureIngestionRecord } from '../../models/submission-feature';
import { BaseRepository } from '../base-repository';
import { resolveSubmissionFeatureParentId, submissionFeatureParentSourceId } from '../sql-fragments';

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
   * Bulk insert uploaded feature rows directly into submission_feature.
   *
   * Identifiers are drawn from the identity sequence in the statement so `urn`
   * (`urn:<submission_id>:<feature_type_name>:<submission_feature_id>`) is written with the row, which skips
   * the per-row `submission_feature_urn` trigger that only fires when `urn` is unset.
   *
   * @param {SubmissionFeatureIngestionRecord[]} records Feature records prepared from the shallow-validated upload batch.
   * @returns {Promise<number>} Number of feature rows inserted.
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatures(records: SubmissionFeatureIngestionRecord[]): Promise<number> {
    if (!records.length) {
      return 0;
    }

    const submissionIds = records.map((record) => record.submissionId);
    const submissionUploadIds = records.map((record) => record.submissionUploadId);
    const sourceIds = records.map((record) => record.sourceId);
    const featureTypeIds = records.map((record) => record.featureTypeId);
    const featureTypeNames = records.map((record) => record.featureTypeName);
    const dataValues = records.map((record) => record.dataJson);
    const dataByteSizes = records.map((record) => record.dataByteSize);
    const contentHashes = records.map((record) => record.contentHash);
    const universalIds = records.map((record) => record.universalId);

    // nextval() is volatile, so the CTE is materialized and every row draws its own identifier.
    const sqlStatement = SQL`
      WITH staged AS (
        SELECT
          nextval(pg_get_serial_sequence('submission_feature', 'submission_feature_id'))::integer AS submission_feature_id,
          batch.*
        FROM unnest(
          ${submissionIds}::integer[],
          ${submissionUploadIds}::uuid[],
          ${sourceIds}::text[],
          ${featureTypeIds}::integer[],
          ${featureTypeNames}::text[],
          ${dataValues}::text[],
          ${dataByteSizes}::bigint[],
          ${contentHashes}::text[],
          ${universalIds}::text[]
        ) AS batch(
          submission_id,
          submission_upload_id,
          source_id,
          feature_type_id,
          feature_type_name,
          data_text,
          data_byte_size,
          content_hash,
          universal_id
        )
      )
      INSERT INTO submission_feature (
        submission_feature_id,
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        urn
      )
      OVERRIDING SYSTEM VALUE
      SELECT
        staged.submission_feature_id,
        staged.submission_id,
        staged.submission_upload_id,
        NULL,
        staged.source_id,
        staged.feature_type_id,
        staged.data_text::jsonb,
        staged.data_byte_size,
        staged.content_hash,
        staged.universal_id,
        concat('urn:', staged.submission_id, ':', staged.feature_type_name, ':', staged.submission_feature_id)
      FROM staged;
    `;

    const response = await this.connection.sql(sqlStatement);
    return response.rowCount ?? 0;
  }

  /**
   * Delete never-published feature rows from an incomplete ingestion attempt.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @returns {Promise<void>} Resolves after all never-published feature rows for the upload have been deleted.
   * @memberof FeatureIngestionRepository
   */
  async deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid
        AND record_effective_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Resolve parent feature references for rows belonging to one upload.
   *
   * Reconciliation resolves parents when it classifies the upload, so on a first indexing run this
   * changes no rows. It re-resolves on re-index, which reuses the reconciled rows, and only rewrites
   * rows whose resolved parent differs from the stored one.
   *
   * Resolution prefers a pending row produced by the current upload, falling back to the
   * submission's current published rows. Ties resolve to the newest row.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @param {number} submissionId The submission the upload belongs to.
   * @returns {Promise<void>} Resolves after changed parent identifiers have been updated for the upload rows.
   * @memberof FeatureIngestionRepository
   */
  async updateSubmissionFeatureParentsBySubmissionUploadId(
    submissionUploadId: string,
    submissionId: number
  ): Promise<void> {
    const sqlStatement = SQL`
      WITH resolved AS (
        SELECT
          child.submission_feature_id,
          `;
    sqlStatement.append(resolveSubmissionFeatureParentId('child'));
    sqlStatement.append(SQL` AS parent_submission_feature_id
        FROM submission_feature AS child
        WHERE child.submission_upload_id = ${submissionUploadId}::uuid
          AND child.submission_id = ${submissionId}
          AND `);
    sqlStatement.append(submissionFeatureParentSourceId('child'));
    sqlStatement.append(SQL` IS NOT NULL
          AND child.record_effective_date IS NULL
          AND child.record_end_date IS NULL
      )
      UPDATE submission_feature AS child
      SET parent_submission_feature_id = resolved.parent_submission_feature_id
      FROM resolved
      WHERE child.submission_feature_id = resolved.submission_feature_id
        AND child.parent_submission_feature_id IS DISTINCT FROM resolved.parent_submission_feature_id;`);

    await this.connection.sql(sqlStatement);
  }
}
