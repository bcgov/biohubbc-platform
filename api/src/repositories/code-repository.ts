import SQL from 'sql-template-strings';
import { FeatureType, FeatureTypeWithProperties } from '../models/feature-type';
import { BaseRepository } from './base-repository';

/**
 * Code repository class.
 *
 * @export
 * @class CodeRepository
 * @extends {BaseRepository}
 */
export class CodeRepository extends BaseRepository {
  /**
   * Get all feature types.
   *
   * @returns {Promise<FeatureType[]>} Active feature type records.
   * @memberof CodeRepository
   */
  async getFeatureTypes(): Promise<FeatureType[]> {
    const sql = SQL`
      SELECT 
        feature_type_id, 
        name,
        display_name,
        description
      FROM 
        feature_type
      WHERE
        feature_type.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, FeatureType);

    return response.rows;
  }

  /**
   * Get every active feature type with the properties the active default Blueprint assigns to it.
   *
   * @returns {Promise<FeatureTypeWithProperties[]>} Active feature types with property metadata.
   * @memberof CodeRepository
   */
  async getFeatureTypePropertyCodes(): Promise<FeatureTypeWithProperties[]> {
    const sql = SQL`
      WITH default_blueprint AS (
        SELECT blueprint_id
        FROM blueprint
        WHERE is_default = true
          AND record_end_date IS NULL
      )
      SELECT
        JSON_BUILD_OBJECT(
          'feature_type_id', ft.feature_type_id,
          'name', ft.name,
          'display_name', ft.display_name,
          'description', ft.description
        ) AS "feature_type",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'blueprint_feature_type_property_id', bftp.blueprint_feature_type_property_id,
              'feature_property_id', fp.feature_property_id,
              'name', fp.name,
              'display_name', fp.display_name,
              'description', fp.description,
              'type_name', fpt.name,
              'required_value', bftp.required_value,
              'calculated_value', fp.calculated_value,
              'allow_multiple', bftp.allow_multiple
            )
            ORDER BY bftp.sort
          ) FILTER (WHERE bftp.blueprint_feature_type_property_id IS NOT NULL),
          '[]'
        ) AS properties
      FROM
        feature_type ft
      LEFT JOIN
        blueprint_feature_type bft ON bft.feature_type_id = ft.feature_type_id
        AND bft.blueprint_id = (SELECT blueprint_id FROM default_blueprint)
        AND bft.record_end_date IS NULL
      LEFT JOIN
        blueprint_feature_type_property bftp ON bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id
        AND bftp.record_end_date IS NULL
      LEFT JOIN
        feature_property fp ON fp.feature_property_id = bftp.feature_property_id
        AND fp.record_end_date IS NULL
      LEFT JOIN
        feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
        AND fpt.record_end_date IS NULL
      WHERE
        ft.record_end_date IS NULL
      GROUP BY
        ft.feature_type_id,
        ft.name,
        ft.display_name
      ORDER BY
        ft.sort ASC;
    `;

    const response = await this.connection.sql(sql, FeatureTypeWithProperties);

    return response.rows;
  }
}
