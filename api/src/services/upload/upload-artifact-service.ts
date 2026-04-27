import { IDBConnection } from '../../database/db';
import { CreateUploadArtifact, UpdateUploadArtifact, UploadArtifact } from '../../models/upload-artifact';
import { UploadArtifactRepository } from '../../repositories/upload/upload-artifact-repository';
import { DBService } from '../db-service';

export class UploadArtifactService extends DBService {
  uploadArtifactServiceRepository: UploadArtifactRepository;

  /**
   * Creates an instance of UploadArtifactService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof UploadArtifactService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.uploadArtifactServiceRepository = new UploadArtifactRepository(connection);
  }

  /**
   * Retrieves a single upload artifact by its ID.
   *
   * @param {string} uploadArtifactId The ID of the upload artifact
   * @return {Promise<UploadArtifact>} The upload artifact record
   * @memberof UploadArtifactService
   */
  async getUploadArtifact(uploadArtifactId: string): Promise<UploadArtifact> {
    return this.uploadArtifactServiceRepository.getUploadArtifact(uploadArtifactId);
  }

  /**
   * Retrieves all upload artifacts in the system.
   *
   * @return {Promise<UploadArtifact[]>} Array of all upload artifacts
   * @memberof UploadArtifactService
   */
  async getUploadArtifacts(): Promise<UploadArtifact[]> {
    return this.uploadArtifactServiceRepository.getUploadArtifacts();
  }

  /**
   * Inserts upload artifact records in bulk.
   *
   * @param {CreateUploadArtifact[]} uploadArtifacts
   * @returns {Promise<{ upload_artifact_id: string }[]>}
   * @memberof UploadArtifactService
   */
  async insertUploadArtifacts(uploadArtifacts: CreateUploadArtifact[]): Promise<{ upload_artifact_id: string }[]> {
    return this.uploadArtifactServiceRepository.insertUploadArtifacts(uploadArtifacts);
  }

  /**
   * Delete archive-derived upload artifact rows for one upload.
   *
   * @param {string} uploadId
   * @returns {Promise<void>}
   * @memberof UploadArtifactService
   */
  async deleteUploadArtifactsByUploadId(uploadId: string): Promise<void> {
    return this.uploadArtifactServiceRepository.deleteUploadArtifactsByUploadId(uploadId);
  }

  /**
   * Updates an existing upload artifact record by ID.
   *
   * @param {string} uploadArtifactId The ID of the upload artifact to update
   * @param {UpdateUploadArtifact} uploadArtifact The upload artifact fields to update
   * @return {Promise<{ upload_artifact_id: string }>} The updated upload artifact ID
   * @memberof UploadArtifactService
   */
  async updateUploadArtifact(
    uploadArtifactId: string,
    uploadArtifact: UpdateUploadArtifact
  ): Promise<{ upload_artifact_id: string }> {
    return this.uploadArtifactServiceRepository.updateUploadArtifact(uploadArtifactId, uploadArtifact);
  }

  /**
   * Deletes an upload artifact record by its ID.
   *
   * @param {string} uploadArtifactId The ID of the upload artifact to delete
   * @return {Promise<void>}
   * @memberof UploadArtifactService
   */
  async deleteUploadArtifact(uploadArtifactId: string): Promise<void> {
    return this.uploadArtifactServiceRepository.deleteUploadArtifact(uploadArtifactId);
  }
}
