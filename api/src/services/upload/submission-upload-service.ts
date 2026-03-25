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
   * Retrieves a submission_upload record only if it belongs to the submission identified by the given UUID.
   * Use this to validate path parameters (submissionId + submissionUploadId) before acting on an upload.
   *
   * @param {string} submissionUuid Submission UUID from path (submission.uuid)
   * @param {string} submissionUploadId Submission upload ID from path
   * @return {Promise<SubmissionUpload>} The submission upload record
   * @throws {ApiNotFoundError} If the submission or upload does not exist, or the upload does not belong to the submission (mapped to 404 by error handler)
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadBySubmissionUuid(
    submissionUuid: string,
    submissionUploadId: string
  ): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);
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
   * Retrieves a submission_upload record by upload_id (reverse lookup).
   *
   * @param {string} uploadId The upload_id to look up
   * @return {Promise<SubmissionUpload | null>} The submission upload record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadByUploadId(uploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadByUploadId(uploadId);
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
   * Soft-deletes a single active submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the record to soft-delete
   * @return {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    return this.submissionUploadRepository.softDeleteSubmissionUpload(submissionUploadId);
  }

  /**
   * Soft-deletes all active submission_upload records for a given submission.
   *
   * @param {number} submissionId The submission whose uploads should be soft-deleted
   * @return {Promise<number>} The number of records soft-deleted
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUploadsBySubmissionId(submissionId: number): Promise<number> {
    return this.submissionUploadRepository.softDeleteSubmissionUploadsBySubmissionId(submissionId);
  }

  /**
   * Soft-deletes a submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the record to soft-delete
   * @return {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async deleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    return this.submissionUploadRepository.deleteSubmissionUpload(submissionUploadId);
  }
}
