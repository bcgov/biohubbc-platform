import { IDBConnection } from '../../database/db';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus,
  SubmissionUploadReviewStatusHistoryRow,
  UpdateSubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { DBService } from '../db-service';

export class SubmissionUploadReviewStatusService extends DBService {
  submissionUploadReviewStatusRepository: SubmissionUploadReviewStatusRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReviewStatusRepository = new SubmissionUploadReviewStatusRepository(connection);
  }

  /**
   * Insert a new review status record for a submission upload.
   * Typically called with status 'submitted' when a new submission upload is created.
   *
   * @param {CreateSubmissionUploadReviewStatus} data
   * @returns {Promise<SubmissionUploadReviewStatus>}
   */
  async insertSubmissionUploadReviewStatus(
    data: CreateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    return this.submissionUploadReviewStatusRepository.insertSubmissionUploadReviewStatus(data);
  }

  /**
   * Get the current review status for a submission upload.
   *
   * @param {string} submissionUploadId
   * @returns {Promise<SubmissionUploadReviewStatus>}
   */
  async getSubmissionUploadReviewStatus(submissionUploadId: string): Promise<SubmissionUploadReviewStatus> {
    return this.submissionUploadReviewStatusRepository.getSubmissionUploadReviewStatus(submissionUploadId);
  }

  /**
   * Update the review status of a submission upload (approved or denied).
   * Only callable by system administrators.
   *
   * @param {string} submissionUploadId
   * @param {UpdateSubmissionUploadReviewStatus} data
   * @returns {Promise<SubmissionUploadReviewStatus>}
   */
  async updateSubmissionUploadReviewStatus(
    submissionUploadId: string,
    data: UpdateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    return this.submissionUploadReviewStatusRepository.updateSubmissionUploadReviewStatus(submissionUploadId, data);
  }

  /**
   * Get publish history for a submission (all submission_upload_status records, newest first).
   *
   * @param {string} submissionUuid
   * @returns {Promise<SubmissionUploadReviewStatusHistoryRow[]>}
   */
  async getSubmissionUploadStatusHistory(
    submissionUuid: string
  ): Promise<SubmissionUploadReviewStatusHistoryRow[]> {
    return this.submissionUploadReviewStatusRepository.getStatusHistoryBySubmissionUuid(submissionUuid);
  }
}
