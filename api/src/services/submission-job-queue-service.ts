import { IDBConnection } from '../database/db';
import { SubmissionJobQueueRepository } from '../repositories/submission-job-queue-repository';
import { SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateDatasetS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { DBService } from './db-service';
import { SubmissionService } from './submission-service';

export class SubmissionJobQueueService extends DBService {
  repository: SubmissionJobQueueRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.repository = new SubmissionJobQueueRepository(connection);
  }

  async intake(dataUUID: string, file: Express.Multer.File): Promise<number> {
    const submissionService = new SubmissionService(this.connection);
    const nextJobId = await this.repository.getNextQueueId();

    await this.uploadDatasetToS3(dataUUID, nextJobId.queueId, file);

    const submission = await submissionService.getSubmissionIdByUUID(dataUUID);
    let submissionId;

    if (!submission) {
      const currentUserId = this.connection.systemUserId();
      const sourceTransformId = await this.getSourceTransformIdForUserId(currentUserId);
      const newId = await submissionService.insertSubmissionRecord(dataUUID, sourceTransformId);
      submissionId = newId.submission_id;
    } else {
      submissionId = submission.submission_id;
    }

    await this.createQueueJob(nextJobId.queueId, submissionId);
    await submissionService.insertSubmissionStatusAndMessage(
      submissionId,
      SUBMISSION_STATUS_TYPE.INGESTED,
      SUBMISSION_MESSAGE_TYPE.NOTICE,
      'Uploaded successfully.'
    );

    return nextJobId.queueId;
  }

  async uploadDatasetToS3(uuid: string, queueId: number, file: Express.Multer.File): Promise<string> {
    const s3Key = generateDatasetS3FileKey({
      fileName: file.originalname,
      uuid,
      queueId
    });
    await uploadFileToS3(file, s3Key, { fileName: file.originalname });
    return s3Key;
  }

  async createQueueJob(queueId: number, submissionId: number): Promise<void> {
    await this.repository.insertJobQueueRecord(queueId, submissionId);
  }

  async getSourceTransformIdForUserId(userId: number): Promise<number> {
    return await this.repository.getSourceTransformIdForUserId(userId);
  }
}
