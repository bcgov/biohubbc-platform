import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactSecurityScanFile,
  CreateArtifactSecurityScanFile,
  UpdateArtifactSecurityScanFile
} from '../../models/artifact-security-scan-file';
import { BaseRepository } from '../base-repository';

export class ArtifactSecurityScanFileRepository extends BaseRepository {
  /**
   * Get a scan file record by its ID.
   *
   * @param {string} uploadArtifactSecurityScanFileId
   * @returns {Promise<ArtifactSecurityScanFile>}
   */
  async getArtifactSecurityScanFile(uploadArtifactSecurityScanFileId: string): Promise<ArtifactSecurityScanFile> {
    const sqlStatement = SQL`
      SELECT
        artifact_security_scan_file_id,
        artifact_security_scan_id,
        file_path,
        status
      FROM
        biohub.artifact_security_scan_file
      WHERE
        artifact_security_scan_file_id = ${uploadArtifactSecurityScanFileId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurityScanFile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get upload artifact security scan file record', [
        'ArtifactSecurityScanFileRepository->getArtifactSecurityScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new scan file record.
   *
   * @param {CreateArtifactSecurityScanFile} scanFile
   * @returns {Promise<{ artifact_security_scan_file_id: string }>}
   */
  async insertArtifactSecurityScanFile(
    scanFile: CreateArtifactSecurityScanFile
  ): Promise<{ artifact_security_scan_file_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_security_scan_file (
        artifact_security_scan_id,
        file_path,
        status
      ) VALUES (
        ${scanFile.artifact_security_scan_id},
        ${scanFile.file_path},
        ${scanFile.security ?? null}
      )
      RETURNING artifact_security_scan_file_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert upload artifact security scan file record', [
        'ArtifactSecurityScanFileRepository->insertArtifactSecurityScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert multiple scan file records in a batch.
   *
   * @param {CreateArtifactSecurityScanFile[]} scanFiles
   * @returns {Promise<{ artifact_security_scan_file_id: string }[]>}
   */
  async insertArtifactSecurityScanFileBatch(
    scanFiles: CreateArtifactSecurityScanFile[]
  ): Promise<{ artifact_security_scan_file_id: string }[]> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_security_scan_file (
        artifact_security_scan_id,
        file_path,
        status
      ) VALUES
    `;

    scanFiles.forEach((file, index) => {
      if (index > 0) {
        sqlStatement.append(SQL`,`);
      }
      sqlStatement.append(SQL`(
        ${file.artifact_security_scan_id},
        ${file.file_path},
        ${file.security ?? null}
      )`);
    });

    sqlStatement.append(SQL` RETURNING artifact_security_scan_file_id`);

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== scanFiles.length) {
      throw new ApiExecuteSQLError('Failed to insert upload artifact security scan file records', [
        'ArtifactSecurityScanFileRepository->insertArtifactSecurityScanFileBatch',
        `rowCount was ${response.rowCount}, expected ${scanFiles.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Update an existing scan file record by ID.
   *
   * @param {string} uploadArtifactSecurityScanFileId
   * @param {UpdateArtifactSecurityScanFile} scanFile
   * @returns {Promise<{ artifact_security_scan_file_id: string }>}
   */
  async updateArtifactSecurityScanFile(
    uploadArtifactSecurityScanFileId: string,
    scanFile: UpdateArtifactSecurityScanFile
  ): Promise<{ artifact_security_scan_file_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_security_scan_file
      SET
        status = COALESCE(${scanFile.security}, status)
      WHERE
        artifact_security_scan_file_id = ${uploadArtifactSecurityScanFileId}
      RETURNING artifact_security_scan_file_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update upload artifact security scan file record', [
        'ArtifactSecurityScanFileRepository->updateArtifactSecurityScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
