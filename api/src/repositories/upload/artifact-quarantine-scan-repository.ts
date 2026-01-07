import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactSecurityScan,
  CreateArtifactSecurityScan,
  UpdateArtifactSecurityScan
} from '../../models/artifact-security-scan';
import { BaseRepository } from '../base-repository';

export class ArtifactSecurityScanRepository extends BaseRepository {
  /**
   * Get a security scan record by ID.
   *
   * @param {string} uploadArtifactSecurityScanId
   * @return {Promise<ArtifactSecurityScan>}
   */
  async getArtifactSecurityScan(uploadArtifactSecurityScanId: string): Promise<ArtifactSecurityScan> {
    const sqlStatement = SQL`
      SELECT
        artifact_security_scan_id,
        artifact_security_id,
        status,
        scanner_version,
        scanned_at,
        results
      FROM
        biohub.artifact_security_scan
      WHERE
        artifact_security_scan_id = ${uploadArtifactSecurityScanId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurityScan);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get security scan record', [
        'ArtifactSecurityScanRepository->getArtifactSecurityScan',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all security scan records.
   *
   * @return {Promise<ArtifactSecurityScan[]>}
   */
  async getArtifactSecurityScans(): Promise<ArtifactSecurityScan[]> {
    const sqlStatement = SQL`
      SELECT
        artifact_security_scan_id,
        artifact_security_id,
        status,
        scanner_version,
        scanned_at,
        results
      FROM
        biohub.artifact_security_scan;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurityScan);

    return response.rows;
  }

  /**
   * Insert a new upload artifact security scan record.
   *
   * @param {CreateArtifactSecurityScan} scan
   * @return {Promise<{ artifact_security_scan_id: string }>}
   */
  async insertArtifactSecurityScan(scan: CreateArtifactSecurityScan): Promise<{ artifact_security_scan_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_security_scan (
        artifact_security_id,
        status,
        scanner_version,
        scanned_at,
        results
      ) VALUES (
        ${scan.artifact_security_id},
        ${scan.status},
        ${scan.scanner_version},
        ${scan.scanned_at},
        ${scan.results}
      )
      RETURNING artifact_security_scan_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security scan record', [
        'ArtifactSecurityScanRepository->insertArtifactSecurityScan',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload artifact security scan record.
   *
   * @param {string} uploadArtifactSecurityScanId
   * @param {UpdateArtifactSecurityScan} scan
   * @return {Promise<{ artifact_security_scan_id: string }>}
   */
  async updateArtifactSecurityScan(
    uploadArtifactSecurityScanId: string,
    scan: UpdateArtifactSecurityScan
  ): Promise<{ artifact_security_scan_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_security_scan
      SET
        artifact_security_id = COALESCE(${scan.artifact_security_id}, artifact_security_id),
        status = COALESCE(${scan.status}, status),
        scanner_version = COALESCE(${scan.scanner_version}, scanner_version),
        scanned_at = COALESCE(${scan.scanned_at}, scanned_at),
        results = COALESCE(${scan.results}, results)
      WHERE
        artifact_security_scan_id = ${uploadArtifactSecurityScanId}
      RETURNING artifact_security_scan_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update security scan record', [
        'ArtifactSecurityScanRepository->updateArtifactSecurityScan',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
