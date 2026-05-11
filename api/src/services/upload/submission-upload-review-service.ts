import { IDBConnection } from '../../database/db';
import {
  CreateSubmissionUploadReview,
  SubmissionUploadReview,
  UpdateSubmissionUploadReview
} from '../../models/submission-upload-review';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
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
 * This service owns the review business rules: creating scoped reviews and
 * creating the default validation/security tasks after successful
 * ingestion. Repository methods remain row-oriented CRUD helpers.
 *
 * @export
 * @class SubmissionUploadReviewService
 * @extends {DBService}
 */
export class SubmissionUploadReviewService extends DBService {
  submissionUploadReviewRepository: SubmissionUploadReviewRepository;
  submissionUploadRepository: SubmissionUploadRepository;

  /**
   * Creates an instance of SubmissionUploadReviewService.
   *
   * @param {IDBConnection} connection - Database connection.
   * @memberof SubmissionUploadReviewService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadReviewRepository = new SubmissionUploadReviewRepository(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
  }

  /**
   * Get active review rows for a submission upload.
   *
   * @param {string} submissionUuid - The submission UUID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows.
   * @memberof SubmissionUploadReviewService
   */
  async findReviewsBySubmissionUploadId(
    submissionUuid: string,
    submissionUploadId: string
  ): Promise<SubmissionUploadReview[]> {
    const submissionUpload = await this.submissionUploadRepository.getSubmissionUploadBySubmissionUuid(
      submissionUuid,
      submissionUploadId
    );

    return this.submissionUploadReviewRepository.findReviewsBySubmissionUploadId(submissionUpload.submission_upload_id);
  }

  /**
   * Insert a scoped review for a submission upload.
   *
   * New rows always start in `requested`; status transitions happen through
   * `updateSubmissionUploadReview`.
   *
   * @param {string} submissionUuid - The submission UUID.
   * @param {CreateSubmissionUploadReview} params - Review insert details.
   * @return {Promise<SubmissionUploadReview>} The created active review row.
   * @memberof SubmissionUploadReviewService
   */
  async insertSubmissionUploadReview(
    submissionUuid: string,
    params: CreateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.insertSubmissionUploadReview(submissionUuid, {
      submission_upload_id: params.submission_upload_id,
      scope: params.scope,
      requested_by: params.requested_by
    });
  }

  /**
   * Request the default validation and security reviews for an upload.
   *
   * Call this only after the upload has successfully passed the ingestion phase
   * that makes it reviewable. The property ingestion service calls this after
   * canonical feature properties and relationships have been inserted.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {number} requestedBy - The system user ID requesting the reviews.
   * @return {Promise<SubmissionUploadReview[]>} The validation and security review rows.
   * @memberof SubmissionUploadReviewService
   */
  async requestDefaultReviewsForUpload(
    submissionId: number,
    submissionUploadId: string,
    requestedBy: number
  ): Promise<SubmissionUploadReview[]> {
    return this.submissionUploadReviewRepository.insertDefaultSubmissionUploadReviews(
      submissionId,
      submissionUploadId,
      requestedBy
    );
  }

  /**
   * Update an active review row.
   *
   * This changes the human-review workflow state only. It does not approve or
   * deny the upload; final disposition remains owned by
   * `SubmissionUploadReviewStatusService`.
   *
   * @param {string} submissionUuid - The submission UUID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @param {UpdateSubmissionUploadReview} data - Review update details.
   * @return {Promise<SubmissionUploadReview>} The updated review row.
   * @memberof SubmissionUploadReviewService
   */
  async updateSubmissionUploadReview(
    submissionUuid: string,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    data: UpdateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.updateSubmissionUploadReview(
      submissionUuid,
      submissionUploadId,
      submissionUploadReviewId,
      data
    );
  }

  /**
   * Soft delete an active review row.
   *
   * Deletes are historical: the row remains in the database with
   * `record_end_date` set, and active queries no longer return it.
   *
   * @param {string} submissionUuid - The submission UUID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @return {Promise<SubmissionUploadReview>} The soft-deleted review row.
   * @memberof SubmissionUploadReviewService
   */
  async deleteSubmissionUploadReview(
    submissionUuid: string,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.deleteSubmissionUploadReview(
      submissionUuid,
      submissionUploadId,
      submissionUploadReviewId
    );
  }
}
