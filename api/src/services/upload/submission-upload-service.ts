import { IDBConnection } from '../../database/db';
import {
  CreateSubmissionUpload,
  SubmissionUpload,
  SubmissionUploadFilters,
  UpdateSubmissionUpload
} from '../../models/submission-upload';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';

export class SubmissionUploadService extends DBService {
  submissionUploadRepository: SubmissionUploadRepository;

  /**
   * Creates an instance of SubmissionUploadService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof SubmissionUploadService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
  }

  /**
   * Retrieves a single submission_upload record by its ID.
   *
   * @param {string} submissionUploadId The ID of the submission upload artifact
   * @return {Promise<SubmissionUpload>} The submission upload artifact record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUpload(submissionUploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
  }

  /**
   * Retrieves all submission_upload records for the given submission, with filters and pagination.
   *
   * @param {number} submissionId
   * @param {SubmissionUploadFilters} filters
   * @param {ApiPaginationOptions} pagination
   * @return {Promise<SubmissionUpload[]>} Array of all submission upload artifacts
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadsBySubmissionId(
    submissionId: number,
    filters?: SubmissionUploadFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SubmissionUpload[]> {
    return this.submissionUploadRepository.getSubmissionUploadsBySubmissionId(submissionId, filters, pagination);
  }

  /**
   * Inserts a new submission_upload record.
   *
   * @param {CreateSubmissionUpload} submissionUpload The artifact data to insert
   * @return {Promise<{ submission_upload_artipfact_id: string }>} Newly created artifact ID
   * @memberof SubmissionUploadService
   */
  async insertSubmissionUpload(submissionUpload: CreateSubmissionUpload): Promise<{ submission_upload_id: string }> {
    return this.submissionUploadRepository.insertSubmissionUpload(submissionUpload);
  }

  /**
   * Updates an existing submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the artifact to update
   * @param {UpdateSubmissionUpload} submissionUpload Fields to update
   * @return {Promise<{ submission_upload_id: string }>} Updated artifact ID
   * @memberof SubmissionUploadService
   */
  async updateSubmissionUpload(
    submissionUploadId: string,
    submissionUpload: UpdateSubmissionUpload
  ): Promise<{ submission_upload_id: string }> {
    return this.submissionUploadRepository.updateSubmissionUpload(submissionUploadId, submissionUpload);
  }

  /**
   * Deletes a submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the artifact to delete
   * @return {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async deleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    return this.submissionUploadRepository.deleteSubmissionUpload(submissionUploadId);
  }
}
