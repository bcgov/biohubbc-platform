import { IDBConnection } from '../../database/db';
import { CreateUploadArchive, UpdateUploadArchive, UploadArchive } from '../../models/upload-archive';
import { UploadArchiveRepository } from '../../repositories/upload/upload-archive-repository';
import { DBService } from '../db-service';

export class UploadArchiveService extends DBService {
  uploadArchiveRepository: UploadArchiveRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArchiveRepository = new UploadArchiveRepository(connection);
  }

  /**
   * Retrieves a single upload archive record by its ID.
   *
   * @param {string} uploadArchiveId The ID of the upload archive record
   * @return {Promise<UploadArchive>} The upload archive record
   * @memberof UploadArchiveService
   */
  async getUploadArchive(uploadArchiveId: string): Promise<UploadArchive> {
    return this.uploadArchiveRepository.getUploadArchive(uploadArchiveId);
  }

  /**
   * Inserts a new upload archive record.
   *
   * @param {CreateUploadArchive} uploadArchive The data for the new upload archive record
   * @return {Promise<{ upload_archive_id: string }>} The newly created upload archive record ID
   * @memberof UploadArchiveService
   */
  async insertUploadArchive(uploadArchive: CreateUploadArchive): Promise<{ upload_archive_id: string }> {
    return this.uploadArchiveRepository.insertUploadArchive(uploadArchive);
  }

  /**
   * Updates an existing upload archive record by ID.
   *
   * @param {string} uploadArchiveId The ID of the upload archive record to update
   * @param {UpdateUploadArchive} uploadArchive The fields to update
   * @return {Promise<{ upload_archive_id: string }>} The updated upload archive record ID
   * @memberof UploadArchiveService
   */
  async updateUploadArchive(
    uploadArchiveId: string,
    uploadArchive: UpdateUploadArchive
  ): Promise<{ upload_archive_id: string }> {
    return this.uploadArchiveRepository.updateUploadArchive(uploadArchiveId, uploadArchive);
  }

  /**
   * Updates an existing upload archive record by ID.
   *
   * @param {string} uploadId The ID of the upload archive record to update
   * @param {UpdateUploadArchive} uploadArchive The fields to update
   * @return {Promise<{ upload_archive_id: string }[]>} The updated upload archive record ID
   * @memberof UploadArchiveService
   */
  async updateUploadArchivesByUploadId(
    uploadId: string,
    uploadArchive: UpdateUploadArchive
  ): Promise<{ upload_archive_id: string }[]> {
    return this.uploadArchiveRepository.updateUploadArchivesByUploadId(uploadId, uploadArchive);
  }

  /**
   * Retrieves all upload archives for a given upload session.
   *
   * @param {string} uploadId The ID of the upload session
   * @return {Promise<UploadArchive[]>} The list of upload archive records associated with the upload session
   * @memberof UploadArchiveService
   */
  async getUploadArchivesByUploadId(uploadId: string): Promise<UploadArchive[]> {
    return this.uploadArchiveRepository.getUploadArchivesByUploadId(uploadId);
  }

  /**
   * Retrieves an upload archive record by artifact ID.
   *
   * @param {string} artifactId The ID of the artifact
   * @return {Promise<UploadArchive | null>} The upload archive record or null if not found
   * @memberof UploadArchiveService
   */
  async getUploadArchiveByArtifactId(artifactId: string): Promise<UploadArchive | null> {
    return this.uploadArchiveRepository.getUploadArchiveByArtifactId(artifactId);
  }

  /**
   * Deletes an upload archive record by its ID.
   *
   * @param {string} uploadArchiveId The ID of the upload archive record to delete
   * @returns {Promise<void>} Resolves when the deletion is complete
   * @memberof UploadArchiveService
   */
  async deleteUploadArchive(uploadArchiveId: string): Promise<void> {
    await this.uploadArchiveRepository.deleteUploadArchive(uploadArchiveId);
  }
}
