import { IDBConnection } from "../database/db";
import { SubmissionJobQueueRepository } from "../repositories/submission-job-queue-repository";
import { generateDatasetS3FileKey, uploadFileToS3 } from "../utils/file-utils";
import { DBService } from "./db-service";
import { SubmissionService } from "./submission-service";


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

  async intake(dataUUID: string, file: Express.Multer.File): Promise<void> {
    const submissionService = new SubmissionService(this.connection)
    const nextTicketId = await this.repository.getNextQueueId();
    // get media from request...

    await this.uploadDatasetToS3(dataUUID, nextTicketId.next_id, file);

    const submission = await submissionService.getSubmissionIdByUUID(dataUUID);
    if (!submission) {
      // create new submission
    }


  }

  async uploadDatasetToS3(uuid: string, queueId: number, file: Express.Multer.File): Promise<void> {
    const s3Key = generateDatasetS3FileKey({
      fileName: file.originalname,
      uuid,
      queueId
    });
    await uploadFileToS3(file, s3Key, {fileName: file.originalname});
  }

  async createQueueJob(queueId: number, submissionId: number): Promise<void> {
    await this.repository.insertQueue(queueId, submissionId)
  }
}