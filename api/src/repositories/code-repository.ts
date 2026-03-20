import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { FeaturePropertyCode, FeatureTypeCode, FeatureTypePropertyCodeRow } from '../models/feature-property';
import { FeatureTypePropertyMetadata } from '../models/submission-feature-property-index';
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
   * @return {*}  {Promise<FeatureTypeCode[]>}
   * @memberof CodeRepository
   */
  async getFeatureTypes(): Promise<FeatureTypeCode[]> {
    const sql = SQL`
      SELECT 
        feature_type_id, 
        name as feature_type_name,
        display_name as feature_type_display_name
      FROM 
        feature_type
      WHERE
        feature_type.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, FeatureTypeCode);

    return response.rows;
  }

  /**
   * Get all feature type property codes for all feature types.
   *
   * @return {*}  {(Promise<FeatureTypePropertyCodeRow[]>)}
   * @memberof CodeRepository
   */
  async getFeatureTypePropertyCodes(): Promise<FeatureTypePropertyCodeRow[]> {
    const sql = SQL`
      SELECT
        ft.feature_type_id,
        ft.name as feature_type_name,
        ft.display_name as feature_type_display_name,
        fp.feature_property_id,
        fp.name as feature_property_name,
        fp.display_name as feature_property_display_name,
        fpt.feature_property_type_id,
        fpt.name as feature_property_type_name
      FROM
        feature_type ft
      INNER JOIN
        feature_type_property ftp on ft.feature_type_id = ftp.feature_type_id
        AND ftp.record_end_date IS NULL
      INNER JOIN
        feature_property fp ON fp.feature_property_id = ftp.feature_property_id
        AND fp.record_end_date IS NULL
      INNER JOIN
        feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
        AND fpt.record_end_date IS NULL
      WHERE
        ft.record_end_date IS NULL
      ORDER BY
        ft.sort,
        ftp.sort
      ASC;
    `;

    const response = await this.connection.sql(sql, FeatureTypePropertyCodeRow);

    return response.rows;
  }

  /**
   * Get a feature property record by name.
   *
   * @param {string} featurePropertyName
   * @return {*}  {Promise<FeaturePropertyCode>}
   * @memberof CodeRepository
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeaturePropertyCode> {
    const sqlStatement = SQL`
    SELECT
      fp.feature_property_id,
      fp.name as feature_property_name,
      fp.display_name as feature_property_display_name,
      fpt.feature_property_type_id,
      fpt.name as feature_property_type_name
    FROM
      feature_property fp
    INNER JOIN
      feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      AND fpt.record_end_date IS NULL
    WHERE
      fp.name = ${featurePropertyName}
      AND fp.record_end_date IS NULL;
  `;

    const response = await this.connection.sql(sqlStatement, FeaturePropertyCode);

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

  /**
   * Get feature type property metadata rows for given feature type ids.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypePropertyMetadata[]>}
   * @memberof CodeRepository
   */
  async getFeatureTypePropertyMetadataByFeatureTypeIds(featureTypeIds: number[]): Promise<FeatureTypePropertyMetadata[]> {
    if (!featureTypeIds.length) {
      return [];
    }

    const sqlStatement = SQL`
      SELECT
        ftp.feature_type_id,
        ftp.feature_type_property_id,
        ftp.allow_multiple,
        fp.name AS feature_property_name,
        fpt.name AS feature_property_type_name
      FROM feature_type_property AS ftp
      INNER JOIN feature_property AS fp
        ON fp.feature_property_id = ftp.feature_property_id
      INNER JOIN feature_property_type AS fpt
        ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE
        ftp.feature_type_id = ANY(${featureTypeIds}::int[])
        AND ftp.record_end_date IS NULL
        AND fp.record_end_date IS NULL
        AND fpt.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, FeatureTypePropertyMetadata);
    return response.rows;
  }
}
