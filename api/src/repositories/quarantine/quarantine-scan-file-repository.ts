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
   *
   * @param {string} quarantineScanFileId - The ID of the quarantine scan file record to retrieve.
   * @returns {Promise<QuarantineScanFileRecord>} The matching quarantine scan file record.
   * @throws {ApiExecuteSQLError} If no record is found or more than one record is returned.
   * @memberof QuarantineScanFileRepository
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
   *
   * @param {IInsertQuarantineScanFile} quarantineScanFile - The data for the new quarantine scan file record.
   * @returns {Promise<{ quarantine_scan_file_id: string }>} The ID of the newly inserted record.
   * @throws {ApiExecuteSQLError} If the insert fails or does not affect exactly one row.
   * @memberof QuarantineScanFileRepository
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
   *
   * @param {IInsertQuarantineScanFile[]} quarantineScanFiles - An array of quarantine scan file data to insert.
   * @returns {Promise<{ quarantine_scan_file_id: string }[]>} The IDs of the newly inserted records.
   * @throws {ApiExecuteSQLError} If the insert fails or the number of inserted rows does not match the array length.
   * @memberof QuarantineScanFileRepository
   */
  async insertQuarantineScanFileRecordBatch(
    quarantineScanFiles: IInsertQuarantineScanFile[]
  ): Promise<{ quarantine_scan_file_id: string }[]> {
    const sqlStatement = SQL`
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
   *
   * @param {string} quarantineScanFileId - The ID of the record to update.
   * @param {IUpdateQuarantineScanFile} quarantineScanFile - The data to update on the record. Fields not provided will remain unchanged.
   * @returns {Promise<{ quarantine_scan_file_id: string }>} The ID of the updated record.
   * @throws {ApiExecuteSQLError} If the update fails or does not affect exactly one row.
   * @memberof QuarantineScanFileRepository
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
}
