import SQL from "sql-template-strings";
import { BaseRepository } from "./base-repository";

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

export class SubmissionJobQueueRepository extends BaseRepository {
  // get next id
  // insert record
  // fetch record
  // update attempt count

  async insertQueue(): Promise<{queue_id: number}> {
    return {queue_id: 0};
  } 

  async getNextQueueId(): Promise<{next_id: number}> {
    const sqlStatement = SQL`
      SELECT nextval(
        pg_get_serial_sequence('submission_job_queue', 'submission_job_queue_id')
      ) as id;
    `;
    let nextId = 1;
    const response = await this.connection.sql<{id: number}>(sqlStatement);

    if (response.rowCount === 1) {
      nextId = response.rows[0].id
    }

    return {next_id: nextId};
  }

  async addAttempt(): Promise<{attempts: number}> {
    return {attempts: 0};
  }

  async getSubmissionJob(queueId: number): Promise<ISubmissionJobQueueModel> {
    return {} as ISubmissionJobQueueModel;
  }
}