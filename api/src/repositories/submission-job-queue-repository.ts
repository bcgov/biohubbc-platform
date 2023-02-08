import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ISecurityRequest } from '../services/submission-job-queue-service';
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
    securityRequest?: ISecurityRequest
  ): Promise<{ queue_id: number }> {
    const sqlStatement = SQL`
      INSERT INTO submission_job_queue (
        submission_job_queue_id,
        submission_id,
        security_request
      ) VALUES (
        ${queueId},
        ${submissionId},
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
      throw new ApiExecuteSQLError('Failed to fetch nextval from sequence', [
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
}
