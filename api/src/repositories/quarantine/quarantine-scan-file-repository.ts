import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  IInsertQuarantineScanFile,
  IUpdateQuarantineScanFile,
  QuarantineScanFileRecord
} from '../../models/quarantine-scan-file';
import { BaseRepository } from '../base-repository';

export class QuarantineScanFileRepository extends BaseRepository {
  /**
   * Get a quarantine scan file record by ID.
   */
  async getQuarantineScanFileRecord(quarantineScanFileId: string): Promise<QuarantineScanFileRecord> {
    const sqlStatement = SQL`
      SELECT
        quarantine_scan_file_id,
        quarantine_scan_id,
        file_path,
        scan_result
      FROM
        biohub.quarantine_scan_file
      WHERE
        quarantine_scan_file_id = ${quarantineScanFileId};
    `;

    const response = await this.connection.sql(sqlStatement, QuarantineScanFileRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get quarantine scan file record', [
        'QuarantineScanFileRepository->getQuarantineScanFileRecord',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new quarantine scan file record.
   */
  async insertQuarantineScanFileRecord(
    quarantineScanFile: IInsertQuarantineScanFile
  ): Promise<{ quarantine_scan_file_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.quarantine_scan_file (
        quarantine_scan_id,
        file_path,
        scan_result
      ) VALUES (
        ${quarantineScanFile.quarantine_scan_id},
        ${quarantineScanFile.file_path},
        ${quarantineScanFile.scan_result}
      )
      RETURNING quarantine_scan_file_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert quarantine scan file record', [
        'QuarantineScanFileRepository->insertQuarantineScanFileRecord',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }
  /**
   * Insert multiple quarantine scan file records in a batch.
   */
  async insertQuarantineScanFileRecordBatch(
    quarantineScanFiles: IInsertQuarantineScanFile[]
  ): Promise<{ quarantine_scan_file_id: string }[]> {
    let sqlStatement = SQL`
    INSERT INTO biohub.quarantine_scan_file (
      quarantine_scan_id,
      file_path,
      scan_result
    ) VALUES
  `;

    // Append each row, separating with commas
    quarantineScanFiles.forEach((file, index) => {
      if (index > 0) {
        sqlStatement.append(SQL`,`);
      }
      sqlStatement.append(SQL`(
      ${file.quarantine_scan_id},
      ${file.file_path},
      ${file.scan_result}
    )`);
    });

    sqlStatement.append(SQL` RETURNING quarantine_scan_file_id`);

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== quarantineScanFiles.length) {
      throw new ApiExecuteSQLError('Failed to insert quarantine scan file records', [
        'QuarantineScanFileRepository->insertQuarantineScanFileRecordBatch',
        `rowCount was ${response.rowCount}, expected ${quarantineScanFiles.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Update an existing quarantine scan file record.
   */
  async updateQuarantineScanFileRecord(
    quarantineScanFileId: string,
    quarantineScanFile: IUpdateQuarantineScanFile
  ): Promise<{ quarantine_scan_file_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.quarantine_scan_file
      SET
        scan_result  = COALESCE(${quarantineScanFile.scan_result}, scan_result)
      WHERE
        quarantine_scan_file_id = ${quarantineScanFileId}
      RETURNING quarantine_scan_file_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update quarantine scan file record', [
        'QuarantineScanFileRepository->updateQuarantineScanFileRecord',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Optional: get all scan files for a specific scan attempt
   */
  async getFilesForQuarantineScan(quarantineScanId: string): Promise<QuarantineScanFileRecord[]> {
    const sqlStatement = SQL`
      SELECT
        quarantine_scan_file_id,
        quarantine_scan_id,
        file_path,
        scan_result
      FROM
        biohub.quarantine_scan_file
      WHERE
        quarantine_scan_id = ${quarantineScanId};
    `;

    const response = await this.connection.sql(sqlStatement, QuarantineScanFileRecord);
    return response.rows;
  }
}
