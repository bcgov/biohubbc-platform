import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { BaseRepository } from './base-repository';

export interface IJobQueueRecord {
  submission_job_queue_id: number;
  submission_id: number;
  job_start_timestamp: string;
  job_stop_timestamp: string;
  security_request: JSON;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

/**
 * A repository class for accessing job queue records.
 *
 * @export
 * @class JobQueueRepository
 * @extends {BaseRepository}
 */
export class JobQueueRepository extends BaseRepository {
  /**
   * Fetch the next available job queue record(s).
   *
   * @param {number} [concurrency] The number of job queue processes that can run concurrently (integer > 0).
   * @param {number} [attempts] The total number of times a job will be attempted until it finishes successfully (integer >= 1).
   * @param {number} [timeout] The maximum duration a running job can take before it is considered timed out.
   * @return {*}  {Promise<IJobQueueRecord[]>}
   * @memberof JobQueueRepository
   */
  async getNextUnprocessedJobQueueRecords(
    concurrency?: number,
    attempts?: number,
    timeout?: number
  ): Promise<IJobQueueRecord[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .select()
      .from('submission_job_queue')
      .where('job_end_timestamp', null)
      .where((qb1) => {
        qb1.orWhere('job_start_timestamp', null);
        if (timeout) {
          qb1.orWhere(knex.raw(`job_start_timestamp < NOW() - INTERVAL '${timeout} milliseconds'`));
        }
      });

    if (attempts) {
      queryBuilder.andWhere('revision_count', '<', attempts);
    }

    queryBuilder.orderBy('submission_job_queue_id', 'ASC');

    if (concurrency) {
      queryBuilder.limit(concurrency);
    }

    console.log(queryBuilder.toSQL().toNative());

    const response = await this.connection.knex<IJobQueueRecord>(queryBuilder);

    return response.rows;
  }

  /**
   * Fetch then ext available job queue record
   *
   * @return {*}  {Promise<IJobQueueRecord>}
   * @memberof JobQueueRepository
   */
  async startQueueRecord(jobQueueId: number): Promise<IJobQueueRecord> {
    const sqlStatement = SQL`
      UPDATE
        submission_job_queue
      SET 
        job_start_timestamp = now()
      WHERE
        submission_job_queue_id = ${jobQueueId};
    `;

    const response = await this.connection.sql<IJobQueueRecord>(sqlStatement);

    return response.rows[0];
  }

  async resetJobQueueRecord(jobQueueId: number): Promise<IJobQueueRecord> {
    const sqlStatement = SQL`
      UPDATE
        submission_job_queue
      SET 
        job_start_timestamp = null,
        job_end_timestamp = null
      WHERE
        submission_job_queue_id = ${jobQueueId};
    `;

    const response = await this.connection.sql<IJobQueueRecord>(sqlStatement);

    return response.rows[0];
  }

  async endJobQueueRecord(jobQueueId: number): Promise<IJobQueueRecord> {
    const sqlStatement = SQL`
      UPDATE
        submission_job_queue
      SET 
        job_end_timestamp = now()
      WHERE
        submission_job_queue_id = ${jobQueueId};
    `;

    const response = await this.connection.sql<IJobQueueRecord>(sqlStatement);

    return response.rows[0];
  }
}
