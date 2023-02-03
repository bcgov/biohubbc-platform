import { IDBConnection } from '../database/db';
import { SubmissionJobQueueRepository } from '../repositories/submission-job-queue-repository';
import { IInsertSubmissionRecord, SubmissionRepository, SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../repositories/submission-repository';
import { generateDatasetS3FileKey, uploadFileToS3 } from '../utils/file-utils';
import { DBService } from './db-service';
import { SubmissionService } from './submission-service';

export class SubmissionJobQueueService extends DBService {
  repository: SubmissionJobQueueRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.repository = new SubmissionJobQueueRepository(connection);
  }

  // steps
  // get next primary key:: is there a chance this could be an issue?
  // get media from request, put into S3
  // create submission record if does not exists for UUID
  // create job queue record
  // write DwCA receive record
  // return primary key

  async intake(dataUUID: string, file: Express.Multer.File): Promise<number> {
    const submissionService = new SubmissionService(this.connection);
    const nextJobId = await this.repository.getNextQueueId();
    // get media from request...

    const key = await this.uploadDatasetToS3(dataUUID, nextJobId.queueId, file);

    const submission = await submissionService.getSubmissionIdByUUID(dataUUID);
    let submissionId = submission.submission_id;
    if (!submission) {
      // create new submission
      const newSubmission = {
        source_transform_id: 1, 
        uuid: dataUUID,
        record_effective_date: "",
        input_key: key,
        input_file_name: file.originalname,
        eml_source: "",
        eml_json_source: "",
        darwin_core_source: ""
      } as IInsertSubmissionRecord
      const newId = await (await submissionService.insertSubmissionRecord(newSubmission));
      submissionId = newId.submission_id;
    }

    await this.createQueueJob(nextJobId.queueId, submissionId);
    submissionService.insertSubmissionStatusAndMessage(submissionId, SUBMISSION_STATUS_TYPE.INGESTED, SUBMISSION_MESSAGE_TYPE.NOTICE, "Uploaded successfully.")

    console.log(submissionId);
    return nextJobId.queueId
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
}
