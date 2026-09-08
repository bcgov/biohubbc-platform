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
 * This service owns the review business rules for explicitly created scoped
 * reviews. Repository methods remain row-oriented CRUD helpers.
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
   * Get one active review belonging to a submission upload.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {string} submissionUploadReviewId Submission upload review identifier.
   * @returns {Promise<SubmissionUploadReview>} Matching active review.
   * @memberof SubmissionUploadReviewService
   */
  async getSubmissionUploadReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.getSubmissionUploadReview(
      submissionId,
      submissionUploadId,
      submissionUploadReviewId
    );
  }

  /**
   * Get active review rows for a submission upload.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @return {Promise<SubmissionUploadReview[]>} Active review rows.
   * @memberof SubmissionUploadReviewService
   */
  async findReviewsBySubmissionUploadId(
    submissionId: number,
    submissionUploadId: string
  ): Promise<SubmissionUploadReview[]> {
    const submissionUpload = await this.submissionUploadRepository.getSubmissionUploadBySubmissionId(
      submissionId,
      submissionUploadId
    );

    return this.submissionUploadReviewRepository.findReviewsBySubmissionUploadId(submissionUpload.submission_upload_id);
  }

  /**
   * Insert a scoped review for a submission upload.
   *
   * Review requests are append-only. Existing reviews for the same upload and
   * scope remain active and unchanged.
   *
   * @param {number} submissionId - The submission ID.
   * @param {CreateSubmissionUploadReview} params - Review insert details, including the initial task status.
   * @return {Promise<SubmissionUploadReview>} The created active review row.
   * @memberof SubmissionUploadReviewService
   */
  async insertSubmissionUploadReview(
    submissionId: number,
    params: CreateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.insertSubmissionUploadReview(submissionId, params);
  }

  /**
   * Update an active review row.
   *
   * This changes the human-review workflow state only. It does not approve or
   * deny the upload; final disposition remains owned by `SubmissionUploadService`.
   *
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @param {UpdateSubmissionUploadReview} data - Review update details.
   * @return {Promise<SubmissionUploadReview>} The updated review row.
   * @memberof SubmissionUploadReviewService
   */
  async updateSubmissionUploadReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    data: UpdateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.updateSubmissionUploadReview(
      submissionId,
      submissionUploadId,
      submissionUploadReviewId,
      data
    );
  }

  /**
   * Update an active review using its numeric submission ID.
   *
   * This changes only the human review workflow status and does not change the
   * submission upload disposition.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {string} submissionUploadReviewId Submission upload review identifier.
   * @param {UpdateSubmissionUploadReview} data Review update details.
   * @returns {Promise<SubmissionUploadReview>} Updated review.
   * @memberof SubmissionUploadReviewService
   */
  async updateSubmissionUploadReviewBySubmissionId(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    data: UpdateSubmissionUploadReview
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.updateSubmissionUploadReviewBySubmissionId(
      submissionId,
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
   * @param {number} submissionId - The submission ID.
   * @param {string} submissionUploadId - The submission upload ID.
   * @param {string} submissionUploadReviewId - The submission upload review ID.
   * @return {Promise<SubmissionUploadReview>} The soft-deleted review row.
   * @memberof SubmissionUploadReviewService
   */
  async deleteSubmissionUploadReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<SubmissionUploadReview> {
    return this.submissionUploadReviewRepository.deleteSubmissionUploadReview(
      submissionId,
      submissionUploadId,
      submissionUploadReviewId
    );
  }
}
