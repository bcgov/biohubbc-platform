import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { BaseRepository } from './base-repository';

export interface IInsertStyleSchema {
  something: any; //TODO
}

export interface IStyleModel {
  something: any; //TODO
}

export class ValidationRepository extends BaseRepository {
  async insertStyleSchema(styleSchema: IInsertStyleSchema): Promise<{ style_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO styles (
       something
      ) VALUES (
        ${styleSchema}
      )
      RETURNING
        stylesheet_id;
    `;

    const response = await this.connection.sql<{ style_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert style schema');
    }
    return { style_id: 1 }; //TODO hard coded
    // return response.rows[0];
  }

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
      throw new HTTP400('Failed to get style schema');
    }

    return { something: 'style' }; //TODO hard coded

    // return response.rows[0];
  }
}
