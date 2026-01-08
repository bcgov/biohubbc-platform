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
        result
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
   * @returns {Promise<ArtifactSecurityScanFile>}
   */
  async insertArtifactSecurityScanFile(scanFile: CreateArtifactSecurityScanFile): Promise<ArtifactSecurityScanFile> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_security_scan_file (
        artifact_security_scan_id,
        file_path,
        result
      ) VALUES (
        ${scanFile.artifact_security_scan_id},
        ${scanFile.file_path},
        ${scanFile.result ?? null}
      )
      RETURNING 
        artifact_security_scan_file_id,
        artifact_security_scan_id,
        file_path,
        result;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurityScanFile);

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
   * @returns {Promise<ArtifactSecurityScanFile[]>}
   */
  async insertArtifactSecurityScanFileBatch(
    scanFiles: CreateArtifactSecurityScanFile[]
  ): Promise<ArtifactSecurityScanFile[]> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_security_scan_file (
        artifact_security_scan_id,
        file_path,
        result
      ) VALUES
    `;

    scanFiles.forEach((file, index) => {
      if (index > 0) {
        sqlStatement.append(SQL`,`);
      }
      sqlStatement.append(SQL`(
        ${file.artifact_security_scan_id},
        ${file.file_path},
        ${file.result ?? null}
      )`);
    });

    sqlStatement.append(
      SQL` RETURNING artifact_security_scan_file_id, artifact_security_scan_id, file_path, security;`
    );

    const response = await this.connection.sql(sqlStatement, ArtifactSecurityScanFile);

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
   * @returns {Promise<ArtifactSecurityScanFile>}
   */
  async updateArtifactSecurityScanFile(
    uploadArtifactSecurityScanFileId: string,
    scanFile: UpdateArtifactSecurityScanFile
  ): Promise<ArtifactSecurityScanFile> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_security_scan_file
      SET
        security = COALESCE(${scanFile.result}, security)
      WHERE
        artifact_security_scan_file_id = ${uploadArtifactSecurityScanFileId}
      RETURNING 
        artifact_security_scan_file_id,
        artifact_security_scan_id,
        file_path,
        result;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurityScanFile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update upload artifact security scan file record', [
        'ArtifactSecurityScanFileRepository->updateArtifactSecurityScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
