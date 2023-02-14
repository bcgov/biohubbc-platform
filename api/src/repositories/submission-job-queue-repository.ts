import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ISecurityRequest } from '../services/submission-job-queue-service';
import { BaseRepository } from './base-repository';

export interface ISubmissionJobQueueRecord {
  submission_job_queue_id: number;
  submission_id: number;
  job_start_timestamp: string | null;
  job_end_timestamp: string | null;
  security_request: JSON | null;
  key: string | null;
  create_date: string;
  create_user: number;
  update_date: string | null;
  update_user: number | null;
  revision_count: number;
}

export interface IInsertSubmissionJobQueueRecord {
  submission_job_queue_id: number;
  submission_id: number;
}

export class SubmissionJobQueueRepository extends BaseRepository {
  /**
   * Creates Job queue and returns the record Id
   *
   * @param {number} queueId
   * @param {number} submissionId
   * @param {IProprietaryInformation} proprietaryInformation
   * @return {*}  {Promise<{ queue_id: number }>}
   * @memberof SubmissionJobQueueRepository
   */
  async insertJobQueueRecord(
    queueId: number,
    submissionId: number,
    s3Key: string,
    securityRequest?: ISecurityRequest
  ): Promise<{ queue_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_job_queue (
        submission_job_queue_id,
        submission_id,
        key,
        security_request
      ) VALUES (
        ${queueId},
        ${submissionId},
        ${s3Key},
        ${JSON.stringify(securityRequest ? securityRequest : {})}
      )
      RETURNING submission_job_queue_id;
    `;

    const response = await this.connection.sql<{ submission_job_queue_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert Queue Job', [
        'SubmissionJobQueueRepository->insertJobQueueRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return { queue_id: response.rows[0].submission_job_queue_id };
  }

  /**
   * Gets the next value from the `submission_job_queue_seq`
   *
   * @return {*}  {Promise<{ queue_id: number }>}
   * @memberof SubmissionJobQueueRepository
   */
  async getNextQueueId(): Promise<{ queueId: number }> {
    const sqlStatement = SQL`
      SELECT nextval('submission_job_queue_seq');
    `;

    const response = await this.connection.sql<{ nextval: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to fetch nextval from submission sequence', [
        'SubmissionJobQueueRepository->getNextQueueId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return { queueId: response.rows[0].nextval };
  }

  /**
   * Finds a transform source Id based for a particular user
   *
   * @param {number} userId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueRepository
   */
  async getSourceTransformIdForUserId(userId: number): Promise<number> {
    const sqlStatement = SQL`
      SELECT source_transform_id 
      FROM source_transform 
      WHERE system_user_id = ${userId};
    `;

    const response = await this.connection.sql<{ source_transform_id: number }>(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get source transform Id', [
        'SubmissionJobQueueRepository->getSourceTransformIdForUserId',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0].source_transform_id;
  }

  /**
   * Fetch the next available job queue record(s).
   *
   * @param {number} [concurrency] The number of job queue processes to select (based on how many can be processed
   * concurrently) (integer > 0).
   * @param {number} [attempts] The total number of times a job will be attempted until it finishes successfully
   * (integer >= 1). This currently leverages the revision_count column, so for an attempts of N, set to N*2.
   * @param {number} [timeout] The maximum duration a running job can take before it is considered timed out. In this
   * case, a job that is not complete, has not reached the attempts limit, and is older than the specified timeout, will
   * be up for re-selection for another attempt.
   * @return {*}  {Promise<ISubmissionJobQueueRecord[]>}
   * @memberof SubmissionJobQueueRepository
   */
  async getNextUnprocessedJobQueueRecords(
    concurrency?: number,
    attempts?: number,
    timeout?: number
  ): Promise<ISubmissionJobQueueRecord[]> {
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

    const response = await this.connection.knex<ISubmissionJobQueueRecord>(queryBuilder);

    return response.rows;
  }

  /**
   * Set the start time of a queue record. Indicating the record has been picked up for processing.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueRepository
   */
  async startQueueRecord(jobQueueId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_job_queue
      SET 
        job_start_timestamp = now()
      WHERE
        submission_job_queue_id = ${jobQueueId};
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to start queue record', [
        'SubmissionJobQueueRepository->startQueueRecord',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }

  /**
   * Reset the start and end time of a queue records. Due to the job failing to complete successfully.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueRepository
   */
  async resetJobQueueRecord(jobQueueId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_job_queue
      SET 
        job_start_timestamp = null,
        job_end_timestamp = null
      WHERE
        submission_job_queue_id = ${jobQueueId};
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to reset queue record', [
        'SubmissionJobQueueRepository->resetJobQueueRecord',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }

  /**
   * Set the end time of a queue records. Indicating the record has completed successfully.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueRepository
   */
  async endJobQueueRecord(jobQueueId: number): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        submission_job_queue
      SET 
        job_end_timestamp = now()
      WHERE
        submission_job_queue_id = ${jobQueueId};
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to end queue record', [
        'SubmissionJobQueueRepository->endJobQueueRecord',
        'rowCount !== 1, expected rowCount === 1'
      ]);
    }
  }
}
