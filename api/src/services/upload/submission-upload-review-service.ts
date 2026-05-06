import { IDBConnection } from '../../database/db';
import { ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadReview,
  SubmissionUploadReview,
  SubmissionUploadReviewFilters,
  SubmissionUploadReviewScope,
  SubmissionUploadReviewStatus,
  SubmissionUploadReviewUpdate
} from '../../models/submission-upload-review';
import { SubmissionUploadReviewRepository } from '../../repositories/upload/submission-upload-review-repository';
import { DBService } from '../db-service';

/**
 * Service for human review tasks scoped to a submission upload.
 *
 * `submission_upload_review` rows represent review work that an admin or
 * system workflow requested for a specific upload. They are separate from:
 *
 * - `submission_upload.status`, which tracks ingestion/indexing lifecycle.
 * - automated validation rows, which track job output and machine checks.
 * - `submission_upload_status`, which tracks final disposition
 *   (`submitted`, `approved`, `denied`, `deleted`).
 *
 * This service owns the review business rules: creating idempotent scoped
 * reviews and creating the default validation/security tasks after successful
 * ingestion. Repository methods remain row-oriented CRUD helpers.
 *
 * @export
 * @class SubmissionUploadReviewService
 * @extends {DBService}
 */
export class SubmissionUploadReviewService extends DBService {
  submissionUploadReviewRepository: SubmissionUploadReviewRepository;

  /**
   * Creates an instance of SubmissionUploadReviewService.
   *
   * @param {IDBConnection} connection - Database connection.
   * @memberof SubmissionUploadReviewService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReviewRepository = new SubmissionUploadReviewRepository(connection);
  }

  /**
   * Get active review rows for a submission upload.
   *
   * Use filters when the caller needs a specific scope or status. For example,
   * `insertSubmissionUploadReview` passes the requested scope here so the
   * database returns only the matching active review row instead of fetching all
   * reviews and filtering in memory.
   *
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {SubmissionUploadReviewFilters} [filters] - Optional review filters.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows.
   * @memberof SubmissionUploadReviewService
   */
  async findReviewsBySubmissionUploadId(
    submissionUploadId: string,
    filters?: SubmissionUploadReviewFilters
  ): Promise<SubmissionUploadReview[]> {
    return this.submissionUploadReviewRepository.findReviewsBySubmissionUploadId(submissionUploadId, filters);
  }

  /**
   * Get active review rows for multiple submission uploads.
   *
   * This is intended for aggregate payloads, such as ticket detail responses,
   * where the service can load all review rows for a set of uploads and attach
   * them to the corresponding upload objects.
   *
   * @param {string[]} submissionUploadIds - The submission upload IDs.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows.
   * @memberof SubmissionUploadReviewService
   */
  async findReviewsBySubmissionUploadIds(submissionUploadIds: string[]): Promise<SubmissionUploadReview[]> {
    return this.submissionUploadReviewRepository.findReviewsBySubmissionUploadIds(submissionUploadIds);
  }

  /**
   * Insert a scoped review for a submission upload.
   *
   * This method is intentionally idempotent for callers that request default
   * workflow tasks from retryable jobs. The repository insert is conflict-safe;
   * if an active row already exists for the upload/scope pair, this method
   * fetches and returns that existing row.
   *
   * New rows always start in `requested`; status transitions happen through
   * `updateReviewStatus`.
   *
   * @param {CreateSubmissionUploadReview} params - Review insert details.
   * @return {Promise<SubmissionUploadReview>} The created or existing active review row.
   * @memberof SubmissionUploadReviewService
   */
  async insertSubmissionUploadReview(params: CreateSubmissionUploadReview): Promise<SubmissionUploadReview> {
    const insertedReview = await this.submissionUploadReviewRepository.insertSubmissionUploadReview({
      submission_upload_id: params.submission_upload_id,
      scope: params.scope,
      requested_by: params.requested_by
    });

    if (insertedReview) {
      return insertedReview;
    }

    const existingReviews = await this.submissionUploadReviewRepository.findReviewsBySubmissionUploadId(
      params.submission_upload_id,
      { scope: params.scope }
    );
    const existingReview = existingReviews[0];

    if (!existingReview) {
      throw new ApiNotFoundError('Submission upload review not found after insert conflict', [
        'SubmissionUploadReviewService->insertSubmissionUploadReview',
        { submissionUploadId: params.submission_upload_id, scope: params.scope }
      ]);
    }

    return existingReview;
  }

  /**
   * Request the default validation and security reviews for an upload.
   *
   * Call this only after the upload has successfully passed the ingestion phase
   * that makes it reviewable. The property ingestion service calls this after
   * canonical feature properties and relationships have been inserted.
   *
   * The two review inserts are independent, so they run concurrently. Each
   * scoped insert is idempotent, which keeps job retries from creating duplicate
   * active review tasks.
   *
   * @param {{ submissionUploadId: string; requestedBy: number }} params - Upload and requester details.
   * @return {Promise<SubmissionUploadReview[]>} The validation and security review rows.
   * @memberof SubmissionUploadReviewService
   */
  async requestDefaultReviewsForUpload(params: {
    submissionUploadId: string;
    requestedBy: number;
  }): Promise<SubmissionUploadReview[]> {
    return Promise.all([
      this.insertSubmissionUploadReview({
        submission_upload_id: params.submissionUploadId,
        scope: SubmissionUploadReviewScope.VALIDATION,
        requested_by: params.requestedBy
      }),
      this.insertSubmissionUploadReview({
        submission_upload_id: params.submissionUploadId,
        scope: SubmissionUploadReviewScope.SECURITY,
        requested_by: params.requestedBy
      })
    ]);
  }

  /**
   * Update an active review row.
   *
   * This changes the human-review workflow state only. It does not approve or
   * deny the upload; final disposition remains owned by
   * `SubmissionUploadReviewStatusService`.
   *
   * @param {{ submissionUploadId: string; submissionUploadReviewId: string; data: SubmissionUploadReviewUpdate }} params - Review update details.
   * @return {Promise<SubmissionUploadReview>} The updated review row.
   * @throws {ApiNotFoundError} When no active review row exists for the ID.
   * @memberof SubmissionUploadReviewService
   */
  async updateSubmissionUploadReview(params: {
    submissionUploadId: string;
    submissionUploadReviewId: string;
    data: SubmissionUploadReviewUpdate;
  }): Promise<SubmissionUploadReview> {
    const review = await this.submissionUploadReviewRepository.updateSubmissionUploadReview(params);

    if (!review) {
      throw new ApiNotFoundError('Submission upload review not found', [
        'SubmissionUploadReviewService->updateSubmissionUploadReview',
        { submissionUploadId: params.submissionUploadId, submissionUploadReviewId: params.submissionUploadReviewId }
      ]);
    }

    return review;
  }

  /**
   * Update an active review row's workflow status.
   *
   * This helper is used by the ID-only admin update route when the caller does
   * not need to validate the parent upload path parameter.
   *
   * @param {{ submissionUploadReviewId: string; status: SubmissionUploadReviewStatus }} params - Review status update.
   * @return {Promise<SubmissionUploadReview>} The updated review row.
   * @throws {ApiNotFoundError} When no active review row exists for the ID.
   * @memberof SubmissionUploadReviewService
   */
  async updateReviewStatus(params: {
    submissionUploadReviewId: string;
    status: SubmissionUploadReviewStatus;
  }): Promise<SubmissionUploadReview> {
    const review = await this.submissionUploadReviewRepository.updateReviewStatus({
      submissionUploadReviewId: params.submissionUploadReviewId,
      data: { status: params.status }
    });

    if (!review) {
      throw new ApiNotFoundError('Submission upload review not found', [
        'SubmissionUploadReviewService->updateReviewStatus',
        { submissionUploadReviewId: params.submissionUploadReviewId }
      ]);
    }

    return review;
  }

  /**
   * Soft delete an active review row.
   *
   * Deletes are historical: the row remains in the database with
   * `record_end_date` set, and active queries no longer return it.
   *
   * @param {{ submissionUploadId: string; submissionUploadReviewId: string }} params - Review delete details.
   * @return {Promise<SubmissionUploadReview>} The soft-deleted review row.
   * @throws {ApiNotFoundError} When no active review row exists for the upload and ID.
   * @memberof SubmissionUploadReviewService
   */
  async deleteSubmissionUploadReview(params: {
    submissionUploadId: string;
    submissionUploadReviewId: string;
  }): Promise<SubmissionUploadReview> {
    const review = await this.submissionUploadReviewRepository.deleteSubmissionUploadReview(params);

    if (!review) {
      throw new ApiNotFoundError('Submission upload review not found', [
        'SubmissionUploadReviewService->deleteSubmissionUploadReview',
        { submissionUploadId: params.submissionUploadId, submissionUploadReviewId: params.submissionUploadReviewId }
      ]);
    }

    return review;
  }
}
