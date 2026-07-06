import { IDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import {
  CreateSubmissionUploadReviewStatus,
  SubmissionUploadReviewStatus,
  UpdateSubmissionUploadReviewStatus
} from '../../models/submission-upload-review-status';
import { ReconciliationOutcomeCounts } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { SubmissionUploadReviewStatusRepository } from '../../repositories/upload/submission-upload-review-status-repository';
import { DBService } from '../db-service';
import { SubmissionFeatureReconciliationService } from '../reconciliation/submission-feature-reconciliation-service';
import { SubmissionFeatureService } from '../submission-feature-service';
import { SubmissionService } from '../submission-service';
import { SubmissionValidationService } from '../submission-validation-service';

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
  submissionFeatureService: SubmissionFeatureService;
  submissionFeatureReconciliationService: SubmissionFeatureReconciliationService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReviewStatusRepository = new SubmissionUploadReviewStatusRepository(connection);
    this.submissionFeatureService = new SubmissionFeatureService(connection);
    this.submissionFeatureReconciliationService = new SubmissionFeatureReconciliationService(connection);
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
   * Record a new review status decision for a submission upload.
   * Only callable by system administrators.
   *
   * `approved` reconciles the upload's pending features against the submission's
   * published state and activates them (see
   * {@link SubmissionFeatureReconciliationService.reconcileAndActivateSubmissionUpload});
   * the per-outcome reconciliation counts are returned alongside the status row.
   * `denied` and `submitted` un-publish the upload's live rows back to pending; rows
   * ended by reconciliation are never resurrected, so a later re-approval re-classifies
   * against whatever is published at that time.
   *
   * @param {string} submissionUploadId
   * @param {UpdateSubmissionUploadReviewStatus} data
   * @returns {Promise<SubmissionUploadReviewStatus & { reconciliation?: ReconciliationOutcomeCounts }>}
   */
  async updateSubmissionUploadReviewStatus(
    submissionUploadId: string,
    data: UpdateSubmissionUploadReviewStatus
  ): Promise<SubmissionUploadReviewStatus & { reconciliation?: ReconciliationOutcomeCounts }> {
    let reconciliation: ReconciliationOutcomeCounts | undefined;

    if (data.status === 'approved') {
      await this.assertSubmissionUploadCanBeApproved(submissionUploadId);
      reconciliation = await this.submissionFeatureReconciliationService.reconcileAndActivateSubmissionUpload(
        submissionUploadId
      );
    }

    if (data.status === 'denied' || data.status === 'submitted') {
      await this.submissionFeatureService.unpublishLiveSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
    }

    const reviewStatus = await this.submissionUploadReviewStatusRepository.insertSubmissionUploadReviewStatus({
      submission_upload_id: submissionUploadId,
      status: data.status
    });

    return reconciliation ? { ...reviewStatus, reconciliation } : reviewStatus;
  }

  /**
   * Assert that a submission upload has completed automated validation for approval.
   *
   * @param {string} submissionUploadId
   * @returns {Promise<void>}
   * @throws {HTTP400} If automated validation is unresolved.
   */
  async assertSubmissionUploadCanBeApproved(submissionUploadId: string): Promise<void> {
    const submissionValidationService = new SubmissionValidationService(this.connection);
    const validation = await submissionValidationService.getSubmissionValidationBySubmissionUploadId(
      submissionUploadId
    );

    if (validation?.status !== 'completed') {
      throw new HTTP400('Submission upload validation must be completed before approval');
    }
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
