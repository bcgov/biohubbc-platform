//DONT MERGE THIS

import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { DBService } from './service';

export interface ISubmissionData {
  source: string;
  uuid: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
}

export class SubmissionService extends DBService {
  async insertSubmission(submissionData: ISubmissionData): Promise<QueryResult<any>> {
    const sqlStatement = SQL`
    INSERT INTO submission (
      source,
      input_key,
      event_timestamp,
      input_file_name
    ) VALUES (
      ${submissionData.source},
      ${submissionData.input_key},
      TIMESTAMP '2020-03-25 12:00:00.123456',
      ${submissionData.input_file_name}
      );
  `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission record');
    }

    return response;
  }
}
