import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
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
        style_id;
    `;

    const response = await this.connection.sql<{ style_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert style schema', [
        'ValidationRepository->insertStyleSchema',
        'rowCount was null or undefined, expeceted rowCount = 1'
      ]);
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
      throw new ApiExecuteSQLError('Failed to get style schema', [
        'ValidationRepository->getStyleSchemaByStyleId',
        'rowCount was null or undefined, expeceted rowCount = 1'
      ]);
    }

    return { something: 'thing' }; //TODO hard coded

    // return response.rows[0];
  }
}
