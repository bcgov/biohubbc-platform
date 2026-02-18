import { IDBConnection } from '../database/db';
import { SubmissionUploadStatus } from '../models/submission-upload-status';
import { SubmissionUploadStatusRepository } from '../repositories/submission-upload-status-repository';
import { DBService } from './db-service';

export class SubmissionUploadStatusService extends DBService {
  submissionUploadStatusRepository: SubmissionUploadStatusRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadStatusRepository = new SubmissionUploadStatusRepository(connection);
  }

  /**
   * Get security details for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<SubmissionUploadStatus>}
   * @memberof SubmissionUploadStatusService
   */
  async getSubmissionUploadStatus(submissionId: number): Promise<SubmissionUploadStatus> {
    return this.submissionUploadStatusRepository.getSubmissionUploadStatusById(submissionId);
  }
}
