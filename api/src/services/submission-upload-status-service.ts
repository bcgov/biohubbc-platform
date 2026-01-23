import { IDBConnection } from '../database/db';
import { SubmissionUploadStatus } from '../models/submission-upload-status';
import { SubmissionUploadStatusRepository } from '../repositories/submission-upload-status-repository';

export class SubmissionUploadStatusService {
  submissionUploadStatusRepository: SubmissionUploadStatusRepository;

  constructor(connection: IDBConnection) {
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
