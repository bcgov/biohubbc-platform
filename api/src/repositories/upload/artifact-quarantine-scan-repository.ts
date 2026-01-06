import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactQuarantineScan,
  CreateArtifactQuarantineScan,
  UpdateArtifactQuarantineScan
} from '../../models/artifact-quarantine-scan';
import { BaseRepository } from '../base-repository';

export class ArtifactQuarantineScanRepository extends BaseRepository {
  /**
   * Get a quarantine scan record by ID.
   *
   * @param {string} uploadArtifactQuarantineScanId
   * @return {Promise<ArtifactQuarantineScan>}
   */
  async getArtifactQuarantineScan(uploadArtifactQuarantineScanId: string): Promise<ArtifactQuarantineScan> {
    const sqlStatement = SQL`
      SELECT
        artifact_quarantine_scan_id,
        artifact_quarantine_id,
        status,
        scanner_version,
        scanned_at,
        results
      FROM
        biohub.artifact_quarantine_scan
      WHERE
        artifact_quarantine_scan_id = ${uploadArtifactQuarantineScanId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactQuarantineScan);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get quarantine scan record', [
        'ArtifactQuarantineScanRepository->getArtifactQuarantineScan',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all quarantine scan records.
   *
   * @return {Promise<ArtifactQuarantineScan[]>}
   */
  async getArtifactQuarantineScans(): Promise<ArtifactQuarantineScan[]> {
    const sqlStatement = SQL`
      SELECT
        artifact_quarantine_scan_id,
        artifact_quarantine_id,
        status,
        scanner_version,
        scanned_at,
        results
      FROM
        biohub.artifact_quarantine_scan;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactQuarantineScan);

    return response.rows;
  }

  /**
   * Insert a new upload artifact quarantine scan record.
   *
   * @param {CreateArtifactQuarantineScan} scan
   * @return {Promise<{ artifact_quarantine_scan_id: string }>}
   */
  async insertArtifactQuarantineScan(
    scan: CreateArtifactQuarantineScan
  ): Promise<{ artifact_quarantine_scan_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_quarantine_scan (
        artifact_quarantine_id,
        status,
        scanner_version,
        scanned_at,
        results
      ) VALUES (
        ${scan.artifact_quarantine_id},
        ${scan.status},
        ${scan.scanner_version},
        ${scan.scanned_at},
        ${scan.results}
      )
      RETURNING artifact_quarantine_scan_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert quarantine scan record', [
        'ArtifactQuarantineScanRepository->insertArtifactQuarantineScan',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload artifact quarantine scan record.
   *
   * @param {string} uploadArtifactQuarantineScanId
   * @param {UpdateArtifactQuarantineScan} scan
   * @return {Promise<{ artifact_quarantine_scan_id: string }>}
   */
  async updateArtifactQuarantineScan(
    uploadArtifactQuarantineScanId: string,
    scan: UpdateArtifactQuarantineScan
  ): Promise<{ artifact_quarantine_scan_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_quarantine_scan
      SET
        artifact_quarantine_id = COALESCE(${scan.artifact_quarantine_id}, artifact_quarantine_id),
        status = COALESCE(${scan.status}, status),
        scanner_version = COALESCE(${scan.scanner_version}, scanner_version),
        scanned_at = COALESCE(${scan.scanned_at}, scanned_at),
        results = COALESCE(${scan.results}, results)
      WHERE
        artifact_quarantine_scan_id = ${uploadArtifactQuarantineScanId}
      RETURNING artifact_quarantine_scan_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update quarantine scan record', [
        'ArtifactQuarantineScanRepository->updateArtifactQuarantineScan',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
