import { IDBConnection } from '../../database/db';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { DBService } from '../db-service';
import { SubmissionService } from '../submission-service';

interface SubmissionHistoryResponse {
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
   * Get submission history by UUID, returning the API response shape (submissionId + history array).
   * When there are no status rows, resolves and verifies the submission ID.
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
      const submission = await submissionService.getSubmissionIdByUUID(submissionUuid);
      submissionId = submission.submission_id;
    }

    const history = rows.map((row) => ({
      submissionUploadId: row.submission_upload_id,
      status: row.status,
      createDate: row.create_date instanceof Date ? row.create_date.toISOString() : String(row.create_date)
    }));

    return { submissionId, history };
  }
}
