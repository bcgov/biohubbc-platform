import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';

export interface IInsertStyleSchema {
  something: any; //TODO
}

export interface IStyleModel {
  something: any; //TODO
}

export interface IFeatureProperties {
  name: string;
  display_name: string;
  description: string;
  type: string;
}

/**
 *THIS REPO IS ALL HARD CODED DO NOT USE
 *
 * @export
 * @class ValidationRepository
 * @extends {BaseRepository}
 */
export class ValidationRepository extends BaseRepository {
  /**
   * Get Feature properties for given feature type
   *
   * @param {string} featureType
   * @return {*}  {Promise<IFeatureProperties[]>}
   * @memberof ValidationRepository
   */
  async getFeatureValidationProperties(featureType: string): Promise<IFeatureProperties[]> {
    const sqlStatement = SQL`
      SELECT
        fp.name,
        fp.display_name,
        fp.description,
        fpt.name as type
      FROM
        feature_type_property ftp
      LEFT JOIN
        feature_property fp
      ON
        ftp.feature_property_id = fp.feature_property_id
      LEFT JOIN
        feature_property_type fpt
      ON
        fp.feature_property_type_id = fpt.feature_property_type_id
      WHERE
        feature_type_id = (select feature_type_id from feature_type ft where ft.name = ${featureType});
    `;

    const response = await this.connection.sql<IFeatureProperties>(sqlStatement);

    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Failed to get dataset validation properties', [
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
