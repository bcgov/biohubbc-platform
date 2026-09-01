import { IDBConnection } from '../../database/db';
import { HTTP409 } from '../../errors/http-error';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { DBService } from '../db-service';
import { SubmissionFeatureService } from '../submission-feature-service';
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
  submissionFeatureService: SubmissionFeatureService;

  /**
   * Create a submission upload review-status service.
   *
   * @param {IDBConnection} connection Database connection used by the review-status repository and services.
   * @memberof SubmissionUploadReviewStatusService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReviewStatusRepository = new SubmissionUploadReviewStatusRepository(connection);
    this.submissionFeatureService = new SubmissionFeatureService(connection);
  }

  /**
   * Insert a new review status record for a submission upload.
   * Typically called with status 'submitted' when a new submission upload is created.
   *
   * @param {CreateSubmissionUploadReviewStatus} data Review-status record to validate and insert.
   * @returns {Promise<SubmissionUploadReviewStatus>} Inserted submission upload review status.
   * @throws {HTTP409} When a non-approval status would reverse an upload with activated features.
   * @memberof SubmissionUploadReviewStatusService
   */
  async insertSubmissionUploadReviewStatus(
    data: CreateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus> {
    if (data.status !== 'approved') {
      await this.assertSubmissionUploadHasNoActivatedFeatures(data.submission_upload_id);
    }

    return this.submissionUploadReviewStatusRepository.insertSubmissionUploadReviewStatus(data);
  }

  /**
   * Assert that an upload has never activated feature state.
   *
   * Once any upload-owned feature has an effective date, later non-approval status changes or upload
   * edits must be represented by a new upload. Superseding those features does not restore mutability.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<void>} Resolves when the upload has no previously activated feature rows.
   * @throws {HTTP409} When the upload owns any feature that has ever been activated.
   * @memberof SubmissionUploadReviewStatusService
   */
  async assertSubmissionUploadHasNoActivatedFeatures(submissionUploadId: string): Promise<void> {
    const activatedCount = await this.submissionFeatureService.getActivatedSubmissionFeatureCountBySubmissionUploadId(
      submissionUploadId
    );

    if (activatedCount > 0) {
      throw new HTTP409(
        'Submission uploads with activated features are immutable. Corrections to published feature state require a new upload.'
      );
    }
  }

  /**
   * Assert that no active upload affected by bulk deletion has ever activated feature state.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<void>} Resolves when no active upload in the submission has activated features.
   * @throws {HTTP409} When any upload owns a feature that has ever been activated.
   * @memberof SubmissionUploadReviewStatusService
   */
  async assertSubmissionHasNoActivatedFeatures(submissionId: number): Promise<void> {
    const activatedCount = await this.submissionFeatureService.getActivatedSubmissionFeatureCountBySubmissionId(
      submissionId
    );

    if (activatedCount > 0) {
      throw new HTTP409(
        'Submission uploads with activated features are immutable. Corrections to published feature state require a new upload.'
      );
    }
  }

  /**
   * Get the current review status for a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadReviewStatus>} Current review status for the submission upload.
   * @memberof SubmissionUploadReviewStatusService
   */
  async getSubmissionUploadReviewStatus(submissionUploadId: string): Promise<SubmissionUploadReviewStatus> {
    return this.submissionUploadReviewStatusRepository.getSubmissionUploadReviewStatus(submissionUploadId);
  }

  /**
   * Get submission history by UUID, returning the API response shape (submissionId + history array).
   * When there are no status rows, resolves and verifies the submission ID.
   *
   * @param {string} submissionUuid Submission UUID whose upload review history is requested.
   * @returns {Promise<SubmissionHistoryResponse>} Submission identifier and chronological upload review history.
   * @throws {ApiNotFoundError} If submission does not exist (when rows.length === 0).
   * @memberof SubmissionUploadReviewStatusService
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
