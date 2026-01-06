import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactQuarantineScanFile,
  CreateArtifactQuarantineScanFile,
  UpdateArtifactQuarantineScanFile
} from '../../models/artifact-quarantine-scan-file';
import { BaseRepository } from '../base-repository';

export class ArtifactQuarantineScanFileRepository extends BaseRepository {
  /**
   * Get a scan file record by its ID.
   *
   * @param {string} uploadArtifactQuarantineScanFileId
   * @returns {Promise<ArtifactQuarantineScanFile>}
   */
  async getArtifactQuarantineScanFile(uploadArtifactQuarantineScanFileId: string): Promise<ArtifactQuarantineScanFile> {
    const sqlStatement = SQL`
      SELECT
        artifact_quarantine_scan_file_id,
        artifact_quarantine_scan_id,
        file_path,
        status
      FROM
        biohub.artifact_quarantine_scan_file
      WHERE
        artifact_quarantine_scan_file_id = ${uploadArtifactQuarantineScanFileId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactQuarantineScanFile);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get upload artifact quarantine scan file record', [
        'ArtifactQuarantineScanFileRepository->getArtifactQuarantineScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new scan file record.
   *
   * @param {CreateArtifactQuarantineScanFile} scanFile
   * @returns {Promise<{ artifact_quarantine_scan_file_id: string }>}
   */
  async insertArtifactQuarantineScanFile(
    scanFile: CreateArtifactQuarantineScanFile
  ): Promise<{ artifact_quarantine_scan_file_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_quarantine_scan_file (
        artifact_quarantine_scan_id,
        file_path,
        status
      ) VALUES (
        ${scanFile.artifact_quarantine_scan_id},
        ${scanFile.file_path},
        ${scanFile.status ?? null}
      )
      RETURNING artifact_quarantine_scan_file_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert upload artifact quarantine scan file record', [
        'ArtifactQuarantineScanFileRepository->insertArtifactQuarantineScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert multiple scan file records in a batch.
   *
   * @param {CreateArtifactQuarantineScanFile[]} scanFiles
   * @returns {Promise<{ artifact_quarantine_scan_file_id: string }[]>}
   */
  async insertArtifactQuarantineScanFileBatch(
    scanFiles: CreateArtifactQuarantineScanFile[]
  ): Promise<{ artifact_quarantine_scan_file_id: string }[]> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_quarantine_scan_file (
        artifact_quarantine_scan_id,
        file_path,
        status
      ) VALUES
    `;

    scanFiles.forEach((file, index) => {
      if (index > 0) {
        sqlStatement.append(SQL`,`);
      }
      sqlStatement.append(SQL`(
        ${file.artifact_quarantine_scan_id},
        ${file.file_path},
        ${file.status ?? null}
      )`);
    });

    sqlStatement.append(SQL` RETURNING artifact_quarantine_scan_file_id`);

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== scanFiles.length) {
      throw new ApiExecuteSQLError('Failed to insert upload artifact quarantine scan file records', [
        'ArtifactQuarantineScanFileRepository->insertArtifactQuarantineScanFileBatch',
        `rowCount was ${response.rowCount}, expected ${scanFiles.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Update an existing scan file record by ID.
   *
   * @param {string} uploadArtifactQuarantineScanFileId
   * @param {UpdateArtifactQuarantineScanFile} scanFile
   * @returns {Promise<{ artifact_quarantine_scan_file_id: string }>}
   */
  async updateArtifactQuarantineScanFile(
    uploadArtifactQuarantineScanFileId: string,
    scanFile: UpdateArtifactQuarantineScanFile
  ): Promise<{ artifact_quarantine_scan_file_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_quarantine_scan_file
      SET
        status = COALESCE(${scanFile.status}, status)
      WHERE
        artifact_quarantine_scan_file_id = ${uploadArtifactQuarantineScanFileId}
      RETURNING artifact_quarantine_scan_file_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update upload artifact quarantine scan file record', [
        'ArtifactQuarantineScanFileRepository->updateArtifactQuarantineScanFile',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
}
