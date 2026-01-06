import { IDBConnection } from '../../database/db';
import { CreateUpload, UpdateUpload, Upload } from '../../models/upload';
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
