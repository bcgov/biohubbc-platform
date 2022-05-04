import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { DBService } from './service';

export interface IInsertSubmissionRecord {
  source: string;
  uuid: string;
  event_timestamp: string;
  input_key: string;
  input_file_name: string;
  eml_source: string;
  darwin_core_source: string;
}

export interface ISubmissionRecord {
  submission_id: number;
  source: string | null;
  uuid: string;
  event_timestamp: string;
  delete_timestamp: string | null;
  input_key: string | null;
  input_file_name: string | null;
  eml_source: string | null;
  darwin_core_source: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export class SubmissionService extends DBService {
  /**
   * Insert a new submission record.
   *
   * @param {IInsertSubmissionRecord} submissionData
   * @return {*}  {Promise<QueryResult<{ submission_id: number }>>}
   * @memberof SubmissionService
   */
  async insertSubmissionRecord(
    submissionData: IInsertSubmissionRecord
  ): Promise<QueryResult<{ submission_id: number }>> {
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
      )
      RETURNING
        submission_id;
    `;

    const response = await this.connection.sql<{ submission_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission record');
    }

    return response;
  }

  /**
   * Update the `input_key` column of a submission record.
   *
   * @param {number} submissionId
   * @param {IInsertSubmissionRecord['input_key']} inputKey
   * @return {*}  {Promise<QueryResult<never>>}
   * @memberof SubmissionService
   */
  async updateSubmissionRecordInputKey(
    submissionId: number,
    inputKey: IInsertSubmissionRecord['input_key']
  ): Promise<QueryResult<never>> {
    const sqlStatement = SQL`
      UPDATE
        submission
      SET
        input_key = ${inputKey}
      WHERE
        submission_id = ${submissionId};
    `;

    const response = await this.connection.sql<never>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission record');
    }

    return response;
  }

  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<ISubmissionRecord> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        submission
      WHERE
        submission_id = ${submissionId};
    `;

    const response = await this.connection.sql<ISubmissionRecord>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new HTTP400('Failed to get submission record');
    }

    return response.rows[0];
  }
}
