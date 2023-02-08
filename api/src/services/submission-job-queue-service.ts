import { IDBConnection } from '../database/db';
import { SubmissionJobQueueRepository } from '../repositories/submission-job-queue-repository';
import { SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateDatasetS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { DBService } from './db-service';
import { SubmissionService } from './submission-service';

export interface IProprietaryInformation {
  first_nations_id: number;
  proprietor_type_id: number;
  survey_id: number;
  rational: string;
  proprietor_name: number;
  disa_required?: boolean;
}

export class SubmissionJobQueueService extends DBService {
  repository: SubmissionJobQueueRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.repository = new SubmissionJobQueueRepository(connection);
  }

  /**
   * Intakes DwCA and preps it for processing. Adding files to S3, tracks submission status and creates a queue record
   *
   * @param {string} dataUUID
   * @param {Express.Multer.File} file
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueService
   */
  async intake(
    dataUUID: string,
    file: Express.Multer.File,
    proprietaryInformation?: IProprietaryInformation
  ): Promise<{ queue_id: number }> {
    const submissionService = new SubmissionService(this.connection);
    const nextJobId = await this.repository.getNextQueueId();

    const key = await this.uploadDatasetToS3(dataUUID, nextJobId.queueId, file);

    const submission = await submissionService.getSubmissionIdByUUID(dataUUID);
    let submissionId;

    if (!submission) {
      const currentUserId = this.connection.systemUserId();
      const sourceTransformId = await this.getSourceTransformIdForUserId(currentUserId);
      const newId = await submissionService.insertSubmissionRecord(dataUUID, sourceTransformId, key);
      submissionId = newId.submission_id;
    } else {
      submissionId = submission.submission_id;
    }

    const queueRecord = await this.createQueueJob(nextJobId.queueId, submissionId, proprietaryInformation);
    await submissionService.insertSubmissionStatusAndMessage(
      submissionId,
      SUBMISSION_STATUS_TYPE.INGESTED,
      SUBMISSION_MESSAGE_TYPE.NOTICE,
      'Uploaded successfully.'
    );

    return queueRecord;
  }

  /**
   * Uploads the DwCA file to S3
   *
   * @param {string} uuid
   * @param {Express.Multer.File} file
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueService
   */
  async uploadDatasetToS3(uuid: string, queueId: number, file: Express.Multer.File): Promise<string> {
    const s3Key = generateDatasetS3FileKey({
      fileName: file.originalname,
      uuid,
      queueId
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
    proprietaryInformation?: IProprietaryInformation
  ): Promise<{ queue_id: number }> {
    return await this.repository.insertJobQueueRecord(queueId, submissionId, proprietaryInformation);
  }

  /**
   * Gets Transform Id for user Id
   *
   * @param {number} userId
   * @return {*}  {Promise<number>}
   * @memberof SubmissionJobQueueService
   */
  async getSourceTransformIdForUserId(userId: number): Promise<number> {
    return await this.repository.getSourceTransformIdForUserId(userId);
  }
}
