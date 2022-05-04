import { QueryResult } from 'pg';
import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { IInsertSubmissionRecord, ISubmissionRecord, SubmissionObject } from '../models/submission/view';
import { DBService } from './service';

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

  async getSubmissionRecordBySubmissionId(submissionId: number): Promise<SubmissionObject> {
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

    return new SubmissionObject(response.rows[0]);
  }
}
