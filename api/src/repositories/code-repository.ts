import SQL from 'sql-template-strings';
import { z } from 'zod';
import { BaseRepository } from './base-repository';

export const ICode = z.object({
  id: z.number(),
  name: z.string()
});

export type ICode = z.infer<typeof ICode>;

export const CodeSet = <T extends z.ZodRawShape>(zodSchema?: T) => {
  return (zodSchema && z.array(ICode.extend(zodSchema))) || z.array(ICode);
};

export const IAllCodeSets = z.object({
  feature_type_with_properties: z.array(
    z.object({
      feature_type: CodeSet(),
      feature_type_properties: z.array(
        CodeSet(z.object({ id: z.number(), name: z.string(), display_name: z.string(), type: z.string() }).shape)
      )
    })
  )
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
   * @return {*}
   * @memberof CodeRepository
   */
  async getFeatureTypes() {
    const sql = SQL`
    SELECT feature_type_id as id, name FROM feature_type;
    `;
    const response = await this.connection.sql(sql);
    return response.rows;
  }

  /**
   * Get all feature type properties.
   *
   * @param {number} featureTypeId
   * @return {*}
   * @memberof CodeRepository
   */
  async getFeatureTypeProperties(featureTypeId: number) {
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
    const response = await this.connection.sql(sql);
    return response.rows;
  }
}
