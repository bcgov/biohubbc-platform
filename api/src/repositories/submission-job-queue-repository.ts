import SQL from 'sql-template-strings';
import { BaseRepository } from './base-repository';

export interface ISubmissionJobQueueModel {
  submission_job_queue_id: number;
  submission_id: number;
  job_start_timestamp: string | null;
  job_end_timestamp: string | null;
  security_request: string | null; // stored as JSON object
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  // no attempt count?
}

export interface IInsertSubmissionJobQueueRecord {
  submission_job_queue_id: number;
  submission_id: number;
}

export class SubmissionJobQueueRepository extends BaseRepository {

  async insertJobQueueRecord(queueId: number, submissionId: number): Promise<{ queue_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_job_queue (
        submission_job_queue_id,
        submission_id
      ) VALUES (
        ${queueId},
        ${submissionId}
      );
    `;

    await this.connection.sql(sqlStatement);
    return { queue_id: 0 };
  }

  async getNextQueueId(): Promise<{ queueId: number }> {
    const sqlStatement = SQL`
      SELECT nextval('submission_job_queue_seq');
    `;

    const response = await this.connection.sql<{ nextval: number }>(sqlStatement);
    return { queueId: response.rows[0].nextval };
  }

  async getSourceTransformIdForUserId(userId: number): Promise<number> {
    const sqlStatement = SQL`
      SELECT source_transform_id 
      FROM source_transform 
      WHERE system_user_id = ${userId};
    `;

    const response = await this.connection.sql<{ source_transform_id: number }>(sqlStatement);
    // TODO should this throw an error if there is no transform for the user?
    return response.rows[0].source_transform_id;
  }
}
