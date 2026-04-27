import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { FeatureType, FeatureTypeWithProperties } from '../models/feature-type';
import { FeatureTypeProperty } from '../models/feature-type-property';
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
   * @return {*}  {Promise<FeatureType[]>}
   * @memberof CodeRepository
   */
  async getFeatureTypes(): Promise<FeatureType[]> {
    const sql = SQL`
      SELECT 
        feature_type_id, 
        name,
        display_name
      FROM 
        feature_type
      WHERE
        feature_type.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, FeatureType);

    return response.rows;
  }

  /**
   * Get all feature type property codes for all feature types.
   *
   * @return {*}  {Promise<FeatureTypeWithProperties[]>}
   * @memberof CodeRepository
   */
  async getFeatureTypePropertyCodes(): Promise<FeatureTypeWithProperties[]> {
    const sql = SQL`
      SELECT
        JSON_BUILD_OBJECT(
          'feature_type_id', ft.feature_type_id,
          'name', ft.name,
          'display_name', ft.display_name
        ) AS "feature_type",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'feature_type_property_id', ftp.feature_type_property_id,
              'name', fp.name,
              'display_name', fp.display_name,
              'description', fp.description,
              'type_name', fpt.name,
              'required_value', ftp.required_value,
              'calculated_value', fp.calculated_value,
              'allow_multiple', ftp.allow_multiple
            )
            ORDER BY ftp.sort
          ) FILTER (WHERE ftp.feature_type_property_id IS NOT NULL),
          '[]'
        ) AS properties
      FROM
        feature_type ft
      LEFT JOIN
        feature_type_property ftp on ft.feature_type_id = ftp.feature_type_id
        AND ftp.record_end_date IS NULL
      LEFT JOIN
        feature_property fp ON fp.feature_property_id = ftp.feature_property_id
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

  /**
   * Get a feature property record by name.
   *
   * @param {string} featurePropertyName
   * @return {*}  {Promise<FeatureTypeProperty>}
   * @memberof CodeRepository
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeatureTypeProperty> {
    const sqlStatement = SQL`
    SELECT
      ftp.feature_type_property_id,
      fp.name,
      fp.display_name,
      fp.description,
      fpt.name as type_name,
      ftp.required_value,
      fp.calculated_value,
      ftp.allow_multiple
    FROM
      feature_type_property ftp
    INNER JOIN
      feature_property fp
      ON fp.feature_property_id = ftp.feature_property_id
      AND fp.record_end_date IS NULL
    INNER JOIN
      feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      AND fpt.record_end_date IS NULL
    WHERE
      fp.name = ${featurePropertyName}
      AND ftp.record_end_date IS NULL
    ORDER BY
      ftp.feature_type_property_id;
  `;

    const response = await this.connection.sql(sqlStatement, FeatureTypeProperty);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Feature property not found', [
        'CodeRepository->getFeaturePropertyByName',
        { featurePropertyName }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'CodeRepository->getFeaturePropertyByName',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}
