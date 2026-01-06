import { IDBConnection } from '../../database/db';
import {
  ArtifactQuarantineScan,
  CreateArtifactQuarantineScan,
  UpdateArtifactQuarantineScan
} from '../../models/artifact-quarantine-scan';
import { ArtifactQuarantineScanRepository } from '../../repositories/upload/artifact-quarantine-scan-repository';
export class ArtifactQuarantineScanService {
  uploadArtifactQuarantineScanRepository: ArtifactQuarantineScanRepository;

  /**
   * Creates an instance of ArtifactQuarantineScanService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactQuarantineScanService
   */
  constructor(connection: IDBConnection) {
    this.uploadArtifactQuarantineScanRepository = new ArtifactQuarantineScanRepository(connection);
  }

  /**
   * Retrieves a single upload artifact quarantine scan record by its ID.
   *
   * @param {string} scanId The ID of the scan record
   * @return {Promise<ArtifactQuarantineScan>} The scan record
   * @memberof ArtifactQuarantineScanService
   */
  async getArtifactQuarantineScan(scanId: string): Promise<ArtifactQuarantineScan> {
    return this.uploadArtifactQuarantineScanRepository.getArtifactQuarantineScan(scanId);
  }

  /**
   * Retrieves all upload artifact quarantine scan records.
   *
   * @return {Promise<ArtifactQuarantineScan[]>} List of scan records
   * @memberof ArtifactQuarantineScanService
   */
  async getArtifactQuarantineScans(): Promise<ArtifactQuarantineScan[]> {
    return this.uploadArtifactQuarantineScanRepository.getArtifactQuarantineScans();
  }

  /**
   * Inserts a new upload artifact quarantine scan record.
   *
   * @param {CreateArtifactQuarantineScan} scan The scan record data
   * @return {Promise<{ artifact_quarantine_scan_id: string }>} The newly created scan record ID
   * @memberof ArtifactQuarantineScanService
   */
  async insertArtifactQuarantineScan(
    scan: CreateArtifactQuarantineScan
  ): Promise<{ artifact_quarantine_scan_id: string }> {
    return this.uploadArtifactQuarantineScanRepository.insertArtifactQuarantineScan(scan);
  }

  /**
   * Updates an existing upload artifact quarantine scan record by ID.
   *
   * @param {string} scanId The ID of the scan record to update
   * @param {UpdateArtifactQuarantineScan} scan The fields to update
   * @return {Promise<{ artifact_quarantine_scan_id: string }>} The updated scan record ID
   * @memberof ArtifactQuarantineScanService
   */
  async updateArtifactQuarantineScan(
    scanId: string,
    scan: UpdateArtifactQuarantineScan
  ): Promise<{ artifact_quarantine_scan_id: string }> {
    return this.uploadArtifactQuarantineScanRepository.updateArtifactQuarantineScan(scanId, scan);
  }
}
