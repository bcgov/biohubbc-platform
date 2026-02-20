import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  FeatureProperty,
  FeatureTypeSummary,
  FeatureTypeWithProperties,
  FeatureTypeWithPropertiesRow
} from '../../models/feature-type';
import { BaseRepository } from '../base-repository';
import { ISubmissionFeature } from '../submission-repository';

/**
 * A repository class for ingestion-related data access.
 *
 * @export
 * @class IngestionRepository
 * @extends {BaseRepository}
 */
export class IngestionRepository extends BaseRepository {
  /**
   * Insert a new submission feature record.
   *
   * @param {number} submissionId The ID of the submission.
   * @param {(number | null)} parentSubmissionFeatureId The ID of the parent submission feature, or null.
   * @param {(string | null)} featureSourceId The source ID of the feature, or null.
   * @param {string} featureTypeName The name of the feature type.
   * @param {ISubmissionFeature['properties']} featureProperties The properties of the submission feature.
   * @param {number} dataByteSizeBytes The byte size of the data.
   * @return {*}  {Promise<{ submission_feature_id: number }>}
   * @memberof IngestionRepository
   */
  async insertSubmissionFeatureRecord(
    submissionId: number,
    parentSubmissionFeatureId: number | null,
    featureSourceId: string | null,
    featureTypeName: string,
    featureProperties: ISubmissionFeature['properties'],
    dataByteSizeBytes: number
  ): Promise<{ submission_feature_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        record_effective_date
      ) VALUES (
        ${submissionId},
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
        'IngestionRepository->insertSubmissionFeatureRecord',
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
   * @memberof IngestionRepository
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
   * Delete all submission features for a submission (soft delete).
   * Used for idempotency - allows job retries to start fresh.
   *
   * @param {number} submissionId The submission ID.
   * @return {Promise<void>}
   * @memberof IngestionRepository
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
   * @memberof IngestionRepository
   */
  async findFeatureTypeWithProperties(name: string): Promise<FeatureTypeWithProperties | null> {
    const sqlStatement = SQL`
      SELECT
        ft.feature_type_id,
        ft.name,
        ft.display_name,
        fp.name as property_name,
        fp.display_name as property_display_name,
        fp.description as property_description,
        fpt.name as property_type_name,
        ftp.required_value,
        fp.calculated_value
      FROM
        feature_type ft
      LEFT JOIN
        feature_type_property ftp ON ft.feature_type_id = ftp.feature_type_id
        AND ftp.record_end_date IS NULL
      LEFT JOIN
        feature_property fp ON ftp.feature_property_id = fp.feature_property_id
        AND fp.record_end_date IS NULL
      LEFT JOIN
        feature_property_type fpt ON fp.feature_property_type_id = fpt.feature_property_type_id
        AND fpt.record_end_date IS NULL
      WHERE
        ft.name = ${name}
        AND ft.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, FeatureTypeWithPropertiesRow);

    // No rows means feature type doesn't exist or is soft-deleted
    if (response.rowCount === 0) {
      return null;
    }

    // Extract feature type info from the first row
    const firstRow = response.rows[0];
    const featureType: FeatureTypeSummary = {
      feature_type_id: firstRow.feature_type_id,
      name: firstRow.name,
      display_name: firstRow.display_name
    };

    // Extract properties from all rows (filter out null properties from LEFT JOIN)
    const properties: FeatureProperty[] = response.rows
      .filter((row) => row.property_name !== null)
      .map((row) => ({
        name: row.property_name as string,
        display_name: row.property_display_name as string,
        description: row.property_description as string,
        type_name: row.property_type_name as string,
        required_value: row.required_value as boolean,
        calculated_value: row.calculated_value as boolean
      }));

    return {
      featureType,
      properties
    };
  }
}
