import { IDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus,
  UpdateSubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';
import { SubmissionValidationService } from '../submission-validation-service';
import { SubmissionUploadReviewService } from './submission-upload-review-service';

export interface SubmissionHistoryResponse {
  submissionId: number;
  history: Array<{
    submissionUploadId: string;
    status: string;
    createDate: string;
  }>;
}

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
    if (data.status === 'approved') {
      await this.assertSubmissionUploadCanBeApproved(submissionUploadId);
    }

    return this.submissionUploadReviewStatusRepository.updateSubmissionUploadReviewStatus(submissionUploadId, data);
  }

  /**
   * Assert that a submission upload has completed all required validation and review gates for approval.
   *
   * @param {string} submissionUploadId
   * @returns {Promise<void>}
   * @throws {HTTP400} If automated validation or required scoped reviews are unresolved.
   */
  async assertSubmissionUploadCanBeApproved(submissionUploadId: string): Promise<void> {
    const submissionValidationService = new SubmissionValidationService(this.connection);
    const validation = await submissionValidationService.getSubmissionValidationBySubmissionUploadId(
      submissionUploadId
    );

    if (validation?.status !== 'completed') {
      throw new HTTP400('Submission upload validation must be completed before approval');
    }

    const uploadReviewService = new SubmissionUploadReviewService(this.connection);
    const hasUnresolvedRequiredReviews = await uploadReviewService.hasUnresolvedRequiredReviews(submissionUploadId);

    if (hasUnresolvedRequiredReviews) {
      throw new HTTP400('Submission upload has unresolved required reviews');
    }
  }

  /**
   * Get submission history by UUID, returning the API response shape (submissionId + history array).
   * When there are no status rows, resolves submissionId via getSubmissionIdByUUID (throws if submission not found).
   *
   * @param {string} submissionUuid
   * @returns {Promise<SubmissionHistoryResponse>}
   * @throws {ApiNotFoundError} If submission does not exist (when rows.length === 0).
   */
  async getSubmissionHistoryByUuid(submissionUuid: string): Promise<SubmissionHistoryResponse> {
    const rows = await this.submissionUploadReviewStatusRepository.getStatusHistoryBySubmissionUuid(submissionUuid);

    let submissionId: number;
    if (rows.length > 0) {
      submissionId = rows[0].submission_id;
    } else {
      const submissionService = new SubmissionService(this.connection);
      const byUuid = await submissionService.getSubmissionIdByUUID(submissionUuid);
      submissionId = byUuid.submission_id;
    }

    const history = rows.map((row) => ({
      submissionUploadId: row.submission_upload_id,
      status: row.status,
      createDate: row.create_date instanceof Date ? row.create_date.toISOString() : String(row.create_date)
    }));

    return { submissionId, history };
  }
}
