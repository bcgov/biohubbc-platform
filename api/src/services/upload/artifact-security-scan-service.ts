import { IDBConnection } from '../../database/db';
import {
  ArtifactSecurityScan,
  CreateArtifactSecurityScan,
  UpdateArtifactSecurityScan
} from '../../models/artifact-security-scan';
import { ArtifactSecurityScanRepository } from '../../repositories/upload/artifact-security-scan-repository';
export class ArtifactSecurityScanService {
  uploadArtifactSecurityScanRepository: ArtifactSecurityScanRepository;

  /**
   * Creates an instance of ArtifactSecurityScanService.
   *
   * @param {IDBConnection} connection Database connection object
   * @memberof ArtifactSecurityScanService
   */
  constructor(connection: IDBConnection) {
    this.uploadArtifactSecurityScanRepository = new ArtifactSecurityScanRepository(connection);
  }

  /**
   * Retrieves a single upload artifact security scan record by its ID.
   *
   * @param {string} scanId The ID of the scan record
   * @return {Promise<ArtifactSecurityScan>} The scan record
   * @memberof ArtifactSecurityScanService
   */
  async getArtifactSecurityScan(scanId: string): Promise<ArtifactSecurityScan> {
    return this.uploadArtifactSecurityScanRepository.getArtifactSecurityScan(scanId);
  }

  /**
   * Retrieves all upload artifact security scan records.
   *
   * @return {Promise<ArtifactSecurityScan[]>} List of scan records
   * @memberof ArtifactSecurityScanService
   */
  async getArtifactSecurityScans(): Promise<ArtifactSecurityScan[]> {
    return this.uploadArtifactSecurityScanRepository.getArtifactSecurityScans();
  }

  /**
   * Inserts a new upload artifact security scan record.
   *
   * @param {CreateArtifactSecurityScan} scan The scan record data
   * @return {Promise<{ artifact_security_scan_id: string }>} The newly created scan record ID
   * @memberof ArtifactSecurityScanService
   */
  async insertArtifactSecurityScan(scan: CreateArtifactSecurityScan): Promise<{ artifact_security_scan_id: string }> {
    return this.uploadArtifactSecurityScanRepository.insertArtifactSecurityScan(scan);
  }

  /**
   * Updates an existing upload artifact security scan record by ID.
   *
   * @param {string} scanId The ID of the scan record to update
   * @param {UpdateArtifactSecurityScan} scan The fields to update
   * @return {Promise<{ artifact_security_scan_id: string }>} The updated scan record ID
   * @memberof ArtifactSecurityScanService
   */
  async updateArtifactSecurityScan(
    scanId: string,
    scan: UpdateArtifactSecurityScan
  ): Promise<{ artifact_security_scan_id: string }> {
    return this.uploadArtifactSecurityScanRepository.updateArtifactSecurityScan(scanId, scan);
  }
}
