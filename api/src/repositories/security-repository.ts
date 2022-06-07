import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';

export interface IInsertSecuritySchema {
  something: any; //TODO
}

export interface ISecurityModel {
  something: any; //TODO
}

export class SecurityRepository extends BaseRepository {
  /**
   *Insert Security Schema into db
   *
   * @param {IInsertSecuritySchema} securitySchema
   * @return {*}  {Promise<{ security_id: number }>}
   * @memberof SecurityRepository
   */
  async insertSecuritySchema(securitySchema: IInsertSecuritySchema): Promise<{ security_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO securityTable (
        something
      ) VALUES (
        ${securitySchema}
      )
      RETURNING
        security_id;
    `;

    const response = await this.connection.sql<{ security_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security schema', [
        'SecurityRepository->insertSecuritySchema',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
    return { security_id: 1 }; //TODO hard coded
    // return response.rows[0];
  }

  /**
   *Get Security Schema from db with given id
   *
   * @param {number} securityId
   * @return {*}  {Promise<ISecurityModel>}
   * @memberof SecurityRepository
   */
  async getSecuritySchemaBySecurityId(securityId: number): Promise<ISecurityModel> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        securityTable
      WHERE
        style_id = ${securityId};
    `;

    const response = await this.connection.sql<ISecurityModel>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get style schema', [
        'SecurityRepository->getSecuritySchemaBySecurityId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return { something: 'thing' }; //TODO hard coded

    // return response.rows[0];
  }
}
