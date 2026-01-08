import { IDBConnection } from '../../database/db';
import {
  ArtifactSecurityScanFile,
  CreateArtifactSecurityScanFile,
  UpdateArtifactSecurityScanFile
} from '../../models/artifact-security-scan-file';
import { ArtifactSecurityScanFileRepository } from '../../repositories/upload/artifact-security-scan-file-repository';
export class ArtifactSecurityScanFileService {
  uploadArtifactSecurityScanFileRepository: ArtifactSecurityScanFileRepository;

  /**
   * Creates an instance of ArtifactSecurityScanFileService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactSecurityScanFileService
   */
  constructor(connection: IDBConnection) {
    this.uploadArtifactSecurityScanFileRepository = new ArtifactSecurityScanFileRepository(connection);
  }

  /**
   * Retrieves a single upload artifact security scan file by its ID.
   *
   * @param {string} scanFileId The ID of the scan file
   * @return {Promise<ArtifactSecurityScanFile>} The scan file record
   * @memberof ArtifactSecurityScanFileService
   */
  async getArtifactSecurityScanFile(scanFileId: string): Promise<ArtifactSecurityScanFile> {
    return this.uploadArtifactSecurityScanFileRepository.getArtifactSecurityScanFile(scanFileId);
  }

  /**
   * Inserts a new upload artifact security scan file record.
   *
   * @param {CreateArtifactSecurityScanFile} scanFile The scan file data
   * @return {Promise<ArtifactSecurityScanFile>} The newly created scan file ID
   * @memberof ArtifactSecurityScanFileService
   */
  async insertArtifactSecurityScanFile(scanFile: CreateArtifactSecurityScanFile): Promise<ArtifactSecurityScanFile> {
    return this.uploadArtifactSecurityScanFileRepository.insertArtifactSecurityScanFile(scanFile);
  }

  /**
   * Inserts multiple upload artifact security scan files in a single batch.
   *
   * @param {CreateArtifactSecurityScanFile[]} scanFiles List of scan files to insert
   * @return {Promise<ArtifactSecurityScanFile[]>} Array of newly created scan file IDs
   * @memberof ArtifactSecurityScanFileService
   */
  async insertArtifactSecurityScanFileBatch(
    scanFiles: CreateArtifactSecurityScanFile[]
  ): Promise<ArtifactSecurityScanFile[]> {
    return this.uploadArtifactSecurityScanFileRepository.insertArtifactSecurityScanFileBatch(scanFiles);
  }

  /**
   * Updates an existing upload artifact security scan file by its ID.
   *
   * @param {string} scanFileId The ID of the scan file to update
   * @param {UpdateArtifactSecurityScanFile} scanFile Fields to update
   * @return {Promise<ArtifactSecurityScanFile>} The updated scan file ID
   * @memberof ArtifactSecurityScanFileService
   */
  async updateArtifactSecurityScanFile(
    scanFileId: string,
    scanFile: UpdateArtifactSecurityScanFile
  ): Promise<ArtifactSecurityScanFile> {
    return this.uploadArtifactSecurityScanFileRepository.updateArtifactSecurityScanFile(scanFileId, scanFile);
  }
}
