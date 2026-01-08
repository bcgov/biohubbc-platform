import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import {
  FeatureProperty,
  FeatureTypeRecord,
  FeatureTypeWithProperties,
  FeatureTypeWithPropertiesRow
} from '../models/feature-type';
import { BaseRepository } from './base-repository';

export interface IInsertStyleSchema {
  something: any; //TODO
}

export interface IStyleModel {
  something: any; //TODO
}

/**
 * A repository class for accessing validation data.
 *
 * @export
 * @class ValidationRepository
 * @extends {BaseRepository}
 */
export class ValidationRepository extends BaseRepository {
  /**
   * Get feature properties for given feature type.
   *
   * @param {string} featureType
   * @return {*}  {Promise<FeatureProperty[]>}
   * @memberof ValidationRepository
   */
  async getFeatureValidationProperties(featureType: string): Promise<FeatureProperty[]> {
    const sqlStatement = SQL`
      SELECT
        feature_property.name,
        feature_property.display_name,
        feature_property.description,
        feature_property_type.name as type_name,
        feature_type_property.required_value
      FROM
        feature_type_property
      INNER JOIN
        feature_property
      ON
        feature_type_property.feature_property_id = feature_property.feature_property_id
      INNER JOIN
        feature_property_type
      ON
        feature_property.feature_property_type_id = feature_property_type.feature_property_type_id
      WHERE
        feature_type_id = (select feature_type_id from feature_type where name = ${featureType})
      AND
        feature_property.calculated_value = false;
    `;

    const response = await this.connection.sql(sqlStatement, FeatureProperty);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError(`Failed to get validation properties for feature type: ${featureType}`, [
        'ValidationRepository->getFeatureValidationProperties',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows;
  }

  /**
   * Get feature type with its associated properties.
   * Returns null if the feature type does not exist.
   * Returns empty properties array if the feature type exists but has no properties.
   *
   * @param {string} name - The feature type name to look up
   * @return {Promise<FeatureTypeWithProperties | null>} The feature type with properties, or null if not found
   * @memberof ValidationRepository
   */
  async getFeatureTypeWithProperties(name: string): Promise<FeatureTypeWithProperties | null> {
    const sqlStatement = SQL`
      SELECT
        ft.feature_type_id,
        ft.name,
        ft.display_name,
        fp.name as property_name,
        fp.display_name as property_display_name,
        fp.description as property_description,
        fpt.name as property_type_name,
        ftp.required_value
      FROM
        feature_type ft
      LEFT JOIN
        feature_type_property ftp ON ft.feature_type_id = ftp.feature_type_id
        AND ftp.record_end_date IS NULL
      LEFT JOIN
        feature_property fp ON ftp.feature_property_id = fp.feature_property_id
        AND fp.calculated_value = false
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
    const featureType: FeatureTypeRecord = {
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
        required_value: row.required_value as boolean
      }));

    return {
      featureType,
      properties
    };
  }

  /**
   * Insert Style sheet into db
   *
   * @param {IInsertStyleSchema} styleSchema
   * @return {*}  {Promise<{ style_id: number }>}
   * @memberof ValidationRepository
   */
  async insertStyleSchema(styleSchema: IInsertStyleSchema): Promise<{ style_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO styles (
       something
      ) VALUES (
        ${styleSchema}
      )
      RETURNING
        style_id;
    `;

    const response = await this.connection.sql<{ style_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert style schema', [
        'ValidationRepository->insertStyleSchema',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return { style_id: 1 }; //TODO hard coded
    // return response.rows[0];
  }

  /**
   * Get Style sheet from db with given id
   *
   * @param {number} styleId
   * @return {*}  {Promise<IStyleModel>}
   * @memberof ValidationRepository
   */
  async getStyleSchemaByStyleId(styleId: number): Promise<IStyleModel> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        styles
      WHERE
      style_id = ${styleId};
    `;

    const response = await this.connection.sql<IStyleModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get style schema', [
        'ValidationRepository->getStyleSchemaByStyleId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return { something: 'thing' }; //TODO hard coded

    // return response.rows[0];
  }
}
