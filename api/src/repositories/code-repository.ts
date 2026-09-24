import SQL from 'sql-template-strings';
import { FeatureType, FeatureTypeWithProperties, FeatureTypeWithPropertyDefinitions } from '../models/feature-type';
import { BaseRepository } from './base-repository';

/**
 * Code repository class.
 *
 * Blueprints govern what is written; they do not govern what can be read. A lookup here is either
 * scoped to one Blueprint and says so in its name (`*ByBlueprintId`), or is global and carries no
 * Blueprint dependency at all.
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
   * Get every active feature type with the properties one Blueprint assigns to it.
   *
   * Every active feature type is listed, so a caller can enumerate feature types from this result; a
   * feature type the Blueprint does not include, or includes with no active assignment, carries an
   * empty `properties` array. Requiredness, multiplicity and order are the Blueprint's assignment.
   *
   * @param {number} blueprintId - The Blueprint whose assignments to read.
   * @returns {Promise<FeatureTypeWithProperties[]>} Active feature types with the Blueprint's assignments.
   * @memberof CodeRepository
   */
  async getFeatureTypePropertiesByBlueprintId(blueprintId: number): Promise<FeatureTypeWithProperties[]> {
    const sql = SQL`
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
        AND bft.blueprint_id = ${blueprintId}
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

  /**
   * Get every active feature type with every property that has ever been assigned to it.
   *
   * The union spans every Blueprint at every lifecycle, so it describes what stored values of the
   * feature type can carry rather than what a Blueprint currently configures. Downloads and exports
   * build their column sets from this: a value stored under an assignment that was later retired,
   * or under a Blueprint that is no longer the default, is still described here. Only property
   * definitions are returned; requiredness, multiplicity and order belong to an assignment.
   *
   * @returns {Promise<FeatureTypeWithPropertyDefinitions[]>} Active feature types with every property ever assigned.
   * @memberof CodeRepository
   */
  async getFeatureTypeProperties(): Promise<FeatureTypeWithPropertyDefinitions[]> {
    const sql = SQL`
      WITH assigned_property AS (
        SELECT
          bft.feature_type_id,
          fp.feature_property_id,
          fp.name,
          fp.display_name,
          fp.description,
          fpt.name AS type_name,
          fp.calculated_value,
          MIN(bftp.sort) AS sort
        FROM
          blueprint_feature_type_property bftp
        INNER JOIN
          blueprint_feature_type bft ON bft.blueprint_feature_type_id = bftp.blueprint_feature_type_id
        INNER JOIN
          feature_property fp ON fp.feature_property_id = bftp.feature_property_id
        INNER JOIN
          feature_property_type fpt ON fpt.feature_property_type_id = fp.feature_property_type_id
        GROUP BY
          bft.feature_type_id,
          fp.feature_property_id,
          fp.name,
          fp.display_name,
          fp.description,
          fpt.name,
          fp.calculated_value
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
              'feature_property_id', ap.feature_property_id,
              'name', ap.name,
              'display_name', ap.display_name,
              'description', ap.description,
              'type_name', ap.type_name,
              'calculated_value', ap.calculated_value
            )
            ORDER BY ap.sort ASC NULLS LAST, ap.name ASC
          ) FILTER (WHERE ap.feature_property_id IS NOT NULL),
          '[]'
        ) AS properties
      FROM
        feature_type ft
      LEFT JOIN
        assigned_property ap ON ap.feature_type_id = ft.feature_type_id
      WHERE
        ft.record_end_date IS NULL
      GROUP BY
        ft.feature_type_id,
        ft.name,
        ft.display_name
      ORDER BY
        ft.sort ASC;
    `;

    const response = await this.connection.sql(sql, FeatureTypeWithPropertyDefinitions);

    return response.rows;
  }
}
