import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { IInsertQuarantineScan, IUpdateQuarantineScan, QuarantineScanRecord } from '../../models/quarantine-scan';
import { BaseRepository } from '../base-repository';

export class QuarantineScanRepository extends BaseRepository {
  /**
   * Get a quarantine scan record by its ID.
   *
   * @param {string} quarantineScanId - The ID of the quarantine scan record to retrieve.
   * @returns {Promise<QuarantineScanRecord>} The matching quarantine scan record.
   * @throws {ApiExecuteSQLError} If the query fails or does not return exactly one record.
   * @memberof QuarantineScanRepository
   */
  async getQuarantineScanRecord(quarantineScanId: string): Promise<QuarantineScanRecord> {
    const sqlStatement = SQL`
      SELECT
        quarantine_scan_id,
        quarantine_id,
        scan_status,
        scanned_at,
        scanner_version,
        results
      FROM
        biohub.quarantine_scan
      WHERE
        quarantine_scan_id = ${quarantineScanId};
    `;

    const response = await this.connection.sql(sqlStatement, QuarantineScanRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get quarantine scan record', [
        'QuarantineScanRepository->getQuarantineScanRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new quarantine scan record.
   *
   * @param {IInsertQuarantineScan} quarantineScan - The data for the new quarantine scan record.
   * @returns {Promise<{ quarantine_scan_id: string }>} The ID of the newly inserted record.
   * @throws {ApiExecuteSQLError} If the insert fails or does not affect exactly one row.
   * @memberof QuarantineScanRepository
   */
  async insertQuarantineScanRecord(quarantineScan: IInsertQuarantineScan): Promise<{ quarantine_scan_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.quarantine_scan (
        quarantine_id,
        scan_status,
        scanned_at,
        scanner_version,
        results
      ) VALUES (
        ${quarantineScan.quarantine_id},
        ${quarantineScan.scan_status ?? 'pending'},
        ${quarantineScan.scanned_at ?? null},
        ${quarantineScan.scanner_version ?? null},
        ${quarantineScan.results ?? null}
      )
      RETURNING quarantine_scan_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert quarantine scan record', [
        'QuarantineScanRepository->insertQuarantineScanRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing quarantine scan record by ID.
   *
   * @param {string} quarantineScanId - The ID of the quarantine scan record to update.
   * @param {IUpdateQuarantineScan} quarantineScan - The data fields to update on the record.
   * @returns {Promise<{ quarantine_scan_id: string }>} The ID of the updated record.
   * @throws {ApiExecuteSQLError} If the update fails or does not affect exactly one row.
   * @memberof QuarantineScanRepository
   */
  async updateQuarantineScanRecord(
    quarantineScanId: string,
    quarantineScan: IUpdateQuarantineScan
  ): Promise<{ quarantine_scan_id: string }> {
    const sqlStatement = SQL`
    UPDATE biohub.quarantine_scan
    SET
      scan_status      = COALESCE(${quarantineScan.scan_status}, scan_status),
      scanned_at       = COALESCE(${quarantineScan.scanned_at}, scanned_at),
      scanner_version  = COALESCE(${quarantineScan.scanner_version}, scanner_version),
      results          = COALESCE(${quarantineScan.results}, results)
    WHERE
      quarantine_scan_id = ${quarantineScanId}
    RETURNING quarantine_scan_id;
  `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update quarantine scan record', [
        'QuarantineScanRepository->updateQuarantineScanRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
