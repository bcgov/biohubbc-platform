import { IDBConnection } from '../../database/db';
import {
  ArtifactQuarantineScanFile,
  CreateArtifactQuarantineScanFile,
  UpdateArtifactQuarantineScanFile
} from '../../models/artifact-quarantine-scan-file';
import { ArtifactQuarantineScanFileRepository } from '../../repositories/upload/artifact-quarantine-scan-file-repository';
export class ArtifactQuarantineScanFileService {
  uploadArtifactQuarantineScanFileRepository: ArtifactQuarantineScanFileRepository;

  /**
   * Creates an instance of ArtifactQuarantineScanFileService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactQuarantineScanFileService
   */
  constructor(connection: IDBConnection) {
    this.uploadArtifactQuarantineScanFileRepository = new ArtifactQuarantineScanFileRepository(connection);
  }

  /**
   * Retrieves a single upload artifact quarantine scan file by its ID.
   *
   * @param {string} scanFileId The ID of the scan file
   * @return {Promise<ArtifactQuarantineScanFile>} The scan file record
   * @memberof ArtifactQuarantineScanFileService
   */
  async getArtifactQuarantineScanFile(scanFileId: string): Promise<ArtifactQuarantineScanFile> {
    return this.uploadArtifactQuarantineScanFileRepository.getArtifactQuarantineScanFile(scanFileId);
  }

  /**
   * Inserts a new upload artifact quarantine scan file record.
   *
   * @param {CreateArtifactQuarantineScanFile} scanFile The scan file data
   * @return {Promise<{ artifact_quarantine_scan_file_id: string }>} The newly created scan file ID
   * @memberof ArtifactQuarantineScanFileService
   */
  async insertArtifactQuarantineScanFile(
    scanFile: CreateArtifactQuarantineScanFile
  ): Promise<{ artifact_quarantine_scan_file_id: string }> {
    return this.uploadArtifactQuarantineScanFileRepository.insertArtifactQuarantineScanFile(scanFile);
  }

  /**
   * Inserts multiple upload artifact quarantine scan files in a single batch.
   *
   * @param {CreateArtifactQuarantineScanFile[]} scanFiles List of scan files to insert
   * @return {Promise<{ artifact_quarantine_scan_file_id: string }[]>} Array of newly created scan file IDs
   * @memberof ArtifactQuarantineScanFileService
   */
  async insertArtifactQuarantineScanFileBatch(
    scanFiles: CreateArtifactQuarantineScanFile[]
  ): Promise<{ artifact_quarantine_scan_file_id: string }[]> {
    return this.uploadArtifactQuarantineScanFileRepository.insertArtifactQuarantineScanFileBatch(scanFiles);
  }

  /**
   * Updates an existing upload artifact quarantine scan file by its ID.
   *
   * @param {string} scanFileId The ID of the scan file to update
   * @param {UpdateArtifactQuarantineScanFile} scanFile Fields to update
   * @return {Promise<{ artifact_quarantine_scan_file_id: string }>} The updated scan file ID
   * @memberof ArtifactQuarantineScanFileService
   */
  async updateArtifactQuarantineScanFile(
    scanFileId: string,
    scanFile: UpdateArtifactQuarantineScanFile
  ): Promise<{ artifact_quarantine_scan_file_id: string }> {
    return this.uploadArtifactQuarantineScanFileRepository.updateArtifactQuarantineScanFile(scanFileId, scanFile);
  }
}
