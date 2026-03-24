import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { FeatureTypeProperty } from '../models/feature-type-property';
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
   * @return {*}  {Promise<FeatureTypeProperty[]>}
   * @memberof ValidationRepository
   */
  async getFeatureValidationProperties(featureType: string): Promise<FeatureTypeProperty[]> {
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

    const response = await this.connection.sql(sqlStatement, FeatureTypeProperty);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError(`Failed to get validation properties for feature type: ${featureType}`, [
        'ValidationRepository->getFeatureValidationProperties',
        'rowCount was null or undefined, expected rowCount != 0'
      ]);
    }

    return response.rows;
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
