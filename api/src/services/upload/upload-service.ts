import dayjs from 'dayjs';
import { IDBConnection } from '../../database/db';
import { HTTP401, HTTP403 } from '../../errors/http-error';
import { CreateUpload, UpdateUpload, Upload, UploadStatusEnum } from '../../models/upload';
import { UploadRepository } from '../../repositories/upload/upload-repository';
import { DBService } from '../db-service';

export class UploadService extends DBService {
  uploadRepository: UploadRepository;

  /**
   * Creates an instance of UploadService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof UploadService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadRepository = new UploadRepository(connection);
  }

  /**
   * Authorize upload completion by requiring the creator and checking membership in the owning submission contributor.
   * A missing association or different creator throws so the middleware's administrator bypass
   * cannot grant access to someone else's upload. Contributor membership follows the usual admin bypass.
   * Team membership is not required: removing the creator from either team does not revoke completion.
   *
   * @param {string} uploadId Upload session identifier.
   * @param {number} systemUserId Authenticated caller.
   * @returns {Promise<boolean>} Whether the creator belongs to the active owning contributor.
   * @throws {HTTP403} If no active submission association exists or the caller is not the creator.
   */
  async isUserAuthorizedForUploadCompletion(uploadId: string, systemUserId: number): Promise<boolean> {
    const access = await this.uploadRepository.findUploadCompletionAccess(uploadId, systemUserId);
    if (access?.create_user !== systemUserId) {
      throw new HTTP403('Only the creator can complete this upload');
    }
    return access.is_contributor_member;
  }

  /**
   * Validate multipart identity, expiry, and pending status before completing an authorized upload.
   * Requires prior Upload middleware authorization for the creator and owning contributor.
   *
   * @param {string} uploadId - The unique identifier for the upload in the system
   * @param {string} s3UploadId - The S3 multipart upload ID, used to verify client intent
   * @returns {Promise<void>} Resolves when the multipart identity and upload state are valid.
   * @throws {HTTP401} If the multipart ID differs or the upload is expired or no longer pending.
   */
  async validateUploadCompletion(uploadId: string, s3UploadId: string): Promise<void> {
    const upload = await this.getUpload(uploadId);

    const now = dayjs();

    const isValid =
      upload.s3_upload_id === s3UploadId &&
      now.isBefore(upload.record_end_date) &&
      upload.upload_status === UploadStatusEnum.PENDING;

    if (!isValid) {
      throw new HTTP401('Access Denied');
    }
  }

  /**
   * Retrieves a single upload record by its ID.
   *
   * @param {string} uploadId The ID of the upload
   * @return {Promise<Upload>} The upload record
   * @memberof UploadService
   */
  async getUpload(uploadId: string): Promise<Upload> {
    return this.uploadRepository.getUpload(uploadId);
  }

  /**
   * Retrieves all uploads in the system.
   *
   * @return {Promise<Upload[]>} Array of all uploads
   * @memberof UploadService
   */
  async getUploads(): Promise<Upload[]> {
    return this.uploadRepository.getUploads();
  }

  /**
   * Inserts a new upload record.
   *
   * @param {CreateUpload} upload The upload data to insert
   * @return {Promise<{ upload_id: string }>} The newly created upload ID
   * @memberof UploadService
   */
  async insertUpload(upload: CreateUpload): Promise<{ upload_id: string }> {
    return this.uploadRepository.insertUpload(upload);
  }

  /**
   * Updates an existing upload record by ID.
   *
   * @param {string} uploadId The ID of the upload to update
   * @param {UpdateUpload} upload The upload fields to update
   * @return {Promise<{ upload_id: string }>} The updated upload ID
   * @memberof UploadService
   */
  async updateUpload(uploadId: string, upload: UpdateUpload): Promise<{ upload_id: string }> {
    return this.uploadRepository.updateUpload(uploadId, upload);
  }

  /**
   * Deletes an upload record by its ID.
   *
   * @param {string} uploadId The ID of the upload to delete
   * @return {Promise<void>}
   * @memberof UploadService
   */
  async deleteUpload(uploadId: string): Promise<void> {
    return this.uploadRepository.deleteUpload(uploadId);
  }
}
