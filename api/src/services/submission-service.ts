import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { DBService } from './service';

export interface ISubmissionData {
  source: string;
  uuid: string;
  event_timestamp: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  darwin_core_source: string;
}

export class SubmissionService extends DBService {
  async insertSubmission(submissionData: ISubmissionData): Promise<QueryResult<any>> {
    const sqlStatement = SQL`
      INSERT INTO submission (
        source,
        uuid,
        event_timestamp,
        input_key,
        input_file_name,
        eml_source,
        darwin_core_source
      ) VALUES (
        ${submissionData.source},
        ${submissionData.uuid},
        ${submissionData.event_timestamp},
        ${submissionData.input_key},
        ${submissionData.input_file_name},
        ${submissionData.eml_source},
        ${submissionData.darwin_core_source}
      );
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission record');
    }

    return response;
  }
}
