import { IDBConnection } from '../../database/db';
import { ApiConflictError } from '../../errors/api-error';
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
   * @returns {Promise<SubmissionUpload>} The submission upload artifact record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUpload(submissionUploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
  }

  /**
   * Retrieves and row-locks a single submission_upload record by its ID.
   *
   * Use this in transactional worker gates to prevent concurrent jobs from
   * starting for the same submission_upload_id.
   *
   * @param {string} submissionUploadId The ID of the submission upload artifact
   * @returns {Promise<SubmissionUpload>} The locked submission upload record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadWithLock(submissionUploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadWithLock(submissionUploadId);
  }

  /**
   * Retrieves a submission_upload record only if it belongs to the submission identified by the given UUID.
   * Use this to validate path parameters (submissionId + submissionUploadId) before acting on an upload.
   *
   * @param {string} submissionUuid Submission UUID from path (submission.uuid)
   * @param {string} submissionUploadId Submission upload ID from path
   * @returns {Promise<SubmissionUpload>} The submission upload record
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
   * @returns {Promise<SubmissionUpload[]>} Array of all submission upload artifacts
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
   * @returns {Promise<SubmissionUpload | null>} The submission upload record
   * @memberof SubmissionUploadService
   */
  async getSubmissionUploadByUploadId(uploadId: string): Promise<SubmissionUpload> {
    return this.submissionUploadRepository.getSubmissionUploadByUploadId(uploadId);
  }

  /**
   * Inserts a new submission_upload record.
   *
   * @param {CreateSubmissionUpload} submissionUpload The artifact data to insert
   * @returns {Promise<{ submission_upload_artipfact_id: string }>} Newly created artifact ID
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
   * @returns {Promise<{ submission_upload_id: string }>} Updated artifact ID
   * @memberof SubmissionUploadService
   */
  async updateSubmissionUpload(
    submissionUploadId: string,
    submissionUpload: UpdateSubmissionUpload
  ): Promise<{ submission_upload_id: string }> {
    return this.submissionUploadRepository.updateSubmissionUpload(submissionUploadId, submissionUpload);
  }

  /**
   * Validate a status transition against an allowed current-status set.
   *
   * @private
   * @param {string} submissionUploadId Submission upload identifier.
   * @param {SubmissionUpload['status']} currentStatus Current persisted status.
   * @param {SubmissionUpload['status']} nextStatus Target status for transition.
   * @param {SubmissionUpload['status'][]} allowedCurrentStatuses Allowed source statuses.
   * @returns {void}
   * @memberof SubmissionUploadService
   */
  private assertSubmissionUploadStatusTransition(
    submissionUploadId: string,
    currentStatus: SubmissionUpload['status'],
    nextStatus: SubmissionUpload['status'],
    allowedCurrentStatuses: SubmissionUpload['status'][]
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus)) {
      throw new ApiConflictError('Invalid submission upload status transition', [
        'SubmissionUploadService->transitionSubmissionUploadStatus',
        { submissionUploadId, currentStatus, nextStatus, allowedCurrentStatuses }
      ]);
    }
  }

  /**
   * Transition submission upload status after asserting the current status is allowed.
   *
   * @param {string} submissionUploadId
   * @param {SubmissionUpload['status']} nextStatus
   * @param {SubmissionUpload['status'][]} allowedCurrentStatuses
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadStatus(
    submissionUploadId: string,
    nextStatus: SubmissionUpload['status'],
    allowedCurrentStatuses: SubmissionUpload['status'][]
  ): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, nextStatus, allowedCurrentStatuses);

    await this.updateSubmissionUpload(submissionUploadId, { status: nextStatus });
  }

  /**
   * Transition to ingested when process stage completes successfully.
   * - ingesting -> ingested
   * - ingested -> ingested (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToIngested(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'ingested') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'ingested', ['ingesting']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'ingested' });
  }

  /**
   * Transition to invalid for deterministic validation failure.
   * - uploaded|ingesting|ingested|indexing -> invalid
   * - invalid -> invalid (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToInvalid(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'invalid') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'invalid', [
      'uploaded',
      'ingesting',
      'ingested',
      'indexing'
    ]);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'invalid' });
  }

  /**
   * Transition to indexing when the indexing stage starts.
   * - ingested -> indexing
   * - indexing -> indexing (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToIndexing(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'indexing') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'indexing', ['ingested']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'indexing' });
  }

  /**
   * Transition to indexed when the indexing stage completes successfully.
   * - indexing -> indexed
   * - indexed -> indexed (no-op)
   * - all other statuses -> conflict
   *
   * @param {string} submissionUploadId Submission upload scope.
   * @returns {Promise<void>}
   */
  async transitionSubmissionUploadToIndexed(submissionUploadId: string): Promise<void> {
    const current = await this.getSubmissionUpload(submissionUploadId);

    if (current.status === 'indexed') {
      return;
    }

    this.assertSubmissionUploadStatusTransition(submissionUploadId, current.status, 'indexed', ['indexing']);
    await this.updateSubmissionUpload(submissionUploadId, { status: 'indexed' });
  }

  /**
   * Soft-deletes a single active submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the record to soft-delete
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    return this.submissionUploadRepository.softDeleteSubmissionUpload(submissionUploadId);
  }

  /**
   * Soft-deletes all active submission_upload records for a given submission.
   *
   * @param {number} submissionId The submission whose uploads should be soft-deleted
   * @returns {Promise<number>} The number of records soft-deleted
   * @memberof SubmissionUploadService
   */
  async softDeleteSubmissionUploadsBySubmissionId(submissionId: number): Promise<number> {
    return this.submissionUploadRepository.softDeleteSubmissionUploadsBySubmissionId(submissionId);
  }

  /**
   * Soft-deletes a submission_upload record by ID.
   *
   * @param {string} submissionUploadId The ID of the record to soft-delete
   * @returns {Promise<void>}
   * @memberof SubmissionUploadService
   */
  async deleteSubmissionUpload(submissionUploadId: string): Promise<void> {
    return this.submissionUploadRepository.deleteSubmissionUpload(submissionUploadId);
  }
}
