import { IDBConnection } from '../database/db';
import {
  ISubmissionJobQueueRecord,
  SubmissionJobQueueRepository
} from '../repositories/submission-job-queue-repository';
import { generateQueueS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { DBService } from './db-service';

export interface ISecurityRequest {
  first_nations_id: number;
  proprietor_type_id: number;
  survey_id: number;
  rational: string;
  proprietor_name: number;
  disa_required?: boolean;
}

export class SubmissionJobQueueService extends DBService {
  jobQueueRepository: SubmissionJobQueueRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.jobQueueRepository = new SubmissionJobQueueRepository(connection);
  }

  /**
   * Intakes DwCA and preps it for processing. Adding files to S3, tracks submission status and creates a queue record
   *
   * @param {string} datasetUUID
   * @param {Express.Multer.File} file
   * @param {ISecurityRequest} [securityRequest]
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueService
   */
  async intake(
    _datasetUUID: string,
    _file: Express.Multer.File,
    _securityRequest?: ISecurityRequest
  ): Promise<{ queue_id: number }> {
    // NOT IMPLEMENTED

    return { queue_id: 0 };
  }

  /**
   * Uploads the DwCA file to S3
   *
   * @param {string} datasetUUID
   * @param {number} queueId
   * @param {Express.Multer.File} file
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueService
   */
  async uploadDatasetToS3(datasetUUID: string, queueId: number, file: Express.Multer.File): Promise<string> {
    const s3Key = generateQueueS3FileKey({
      queueId: queueId,
      datasetUUID: datasetUUID,
      fileName: file.originalname
    });
    await uploadFileToS3(file, s3Key, { fileName: file.originalname });
    return s3Key;
  }

  /**
   * Creates a queue job for a submission
   *
   * @param {number} queueId
   * @param {number} submissionId
   * @param {IProprietaryInformation} proprietaryInformation
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueService
   */
  async createQueueJob(
    queueId: number,
    submissionId: number,
    s3Key: string,
    securityRequest?: ISecurityRequest
  ): Promise<{ queue_id: number }> {
    return await this.jobQueueRepository.insertJobQueueRecord(queueId, submissionId, s3Key, securityRequest);
  }

  /**
   * Fetch the next available job queue record(s).
   *
   * @param {number} [concurrency] The number of job queue processes to select (based on how many can be processed
   * concurrently) (integer > 0).
   * @param {number} [attempts] The total number of times a job will be attempted until it finishes successfully
   * (integer >= 1).
   * @param {number} [timeout] The maximum time a job can run before it is considered timed out. In this case, the
   * timeout is used to fetch any records that had been started, but experienced an issue that caused them
   * to fail and also not properly reset their start time. This scenario is expected to occur rarely if not never.
   * @return {*}  {Promise<ISubmissionJobQueueRecord[]>}
   * @memberof JobQueueService
   */
  async getNextUnprocessedJobQueueRecords(
    concurrency?: number,
    attempts?: number,
    timeout?: number
  ): Promise<ISubmissionJobQueueRecord[]> {
    return this.jobQueueRepository.getNextUnprocessedJobQueueRecords(concurrency, attempts, timeout);
  }

  /**
   * Update a job queue record, setting the start time to now.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueService
   */
  async startQueueRecord(jobQueueId: number): Promise<void> {
    return this.jobQueueRepository.startQueueRecord(jobQueueId);
  }

  /**
   * Update a job queue record, setting the end time to now.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueService
   */
  async endJobQueueRecord(jobQueueId: number): Promise<void> {
    return this.jobQueueRepository.endJobQueueRecord(jobQueueId);
  }

  /**
   * Update a job queue record, setting the start and end times to null.
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueService
   */
  async resetJobQueueRecord(jobQueueId: number): Promise<void> {
    return this.jobQueueRepository.resetJobQueueRecord(jobQueueId);
  }

  /**
   * Update a job queue record, incrementing the attempt count;
   *
   * @param {number} jobQueueId
   * @return {*}  {Promise<void>}
   * @memberof SubmissionJobQueueService
   */
  async incrementAttemptCount(jobQueueId: number): Promise<void> {
    return this.jobQueueRepository.incrementAttemptCount(jobQueueId);
  }
}
