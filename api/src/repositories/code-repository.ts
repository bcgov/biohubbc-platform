import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { FeaturePropertyRecord } from './search-index-respository';

const FeatureTypeCode = z.object({
  id: z.number(),
  name: z.string()
});

export type FeatureTypeCode = z.infer<typeof FeatureTypeCode>;

const FeaturePropertyCode = z.object({
  id: z.number(),
  name: z.string(),
  display_name: z.string(),
  type: z.string()
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
   * @return {*}  {Promise<FeatureTypeWithFeaturePropertiesCode['feature_type'][]>}
   * @memberof CodeRepository
   */
  async getFeatureTypes(): Promise<FeatureTypeWithFeaturePropertiesCode['feature_type'][]> {
    const sql = SQL`
      SELECT 
        feature_type_id as id, 
        name
      FROM 
        feature_type;
    `;

    const response = await this.connection.sql(sql, FeatureTypeWithFeaturePropertiesCode['feature_type']);

    return response.rows;
  }

  /**
   * Get all feature type properties for the specified feature type.
   *
   * @param {number} featureTypeId
   * @return {*}  {Promise<FeaturePropertyCode[]>}
   * @memberof CodeRepository
   */
  async getFeatureTypeProperties(featureTypeId: number): Promise<FeaturePropertyCode[]> {
    const sql = SQL`
      SELECT
        ftp.feature_type_property_id as id,
        fp.name as name,
        fp.display_name as display_name,
        fpt.name as type
      FROM
        feature_type_property ftp
      INNER JOIN
        feature_property fp ON fp.feature_property_id = ftp.feature_property_id
      INNER JOIN
        feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE
        ftp.feature_type_id = ${featureTypeId}
      ORDER BY
        ftp.sort
      ASC;
    `;

    const response = await this.connection.sql(sql, FeaturePropertyCode);

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
