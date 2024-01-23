import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { FeaturePropertyRecord } from './search-index-respository';

const FeatureTypeCode = z.object({
  feature_type_id: z.number(),
  feature_type_name: z.string(),
  feature_type_display_name: z.string()
});

export type FeatureTypeCode = z.infer<typeof FeatureTypeCode>;

const FeaturePropertyCode = z.object({
  feature_property_id: z.number(),
  feature_property_name: z.string(),
  feature_property_display_name: z.string(),
  feature_property_type_id: z.number(),
  feature_property_type_name: z.string()
});

export type FeaturePropertyCode = z.infer<typeof FeaturePropertyCode>;

const FeatureTypeWithFeaturePropertiesCode = z.object({
  feature_type: FeatureTypeCode,
  feature_type_properties: z.array(FeaturePropertyCode)
});

export type FeatureTypeWithFeaturePropertiesCode = z.infer<typeof FeatureTypeWithFeaturePropertiesCode>;

export const IAllCodeSets = z.object({
  feature_type_with_properties: z.array(FeatureTypeWithFeaturePropertiesCode)
});

export type IAllCodeSets = z.infer<typeof IAllCodeSets>;

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
        feature_type;
    `;

    const response = await this.connection.sql(sql, FeatureTypeCode);

    return response.rows;
  }

  /**
   * Get all feature type property codes for all feature types.
   *
   * @return {*}  {(Promise<(FeatureTypeCode & FeaturePropertyCode)[]>)}
   * @memberof CodeRepository
   */
  async getFeatureTypePropertyCodes(): Promise<(FeatureTypeCode & FeaturePropertyCode)[]> {
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
      INNER JOIN
        feature_property fp ON fp.feature_property_id = ftp.feature_property_id
      INNER JOIN
        feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      ORDER BY
        ft.sort, 
        ftp.sort
      ASC;
    `;

    const response = await this.connection.sql(sql, FeatureTypeCode.merge(FeaturePropertyCode));

    return response.rows;
  }

  /**
   * Get a feature property record by name.
   *
   * @param {string} featurePropertyName
   * @return {*}  {Promise<FeaturePropertyRecord>}
   * @memberof CodeRepository
   */
  async getFeaturePropertyByName(featurePropertyName: string): Promise<FeaturePropertyRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        feature_property
      WHERE
        name = ${featurePropertyName};
    `;

    const response = await this.connection.sql(sqlStatement, FeaturePropertyRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get feature property record', [
        'CodeRepository->getFeaturePropertyByName',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }

    return response.rows[0];
  }
}
