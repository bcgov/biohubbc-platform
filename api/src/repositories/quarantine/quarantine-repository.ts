import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { IInsertQuarantine, IUpdateQuarantine, QuarantineRecord } from '../../models/quarantine';
import { BaseRepository } from '../base-repository';

export class QuarantineRepository extends BaseRepository {
  /**
   * Get a quarantine record by ID.
   *
   * @param {string} quarantineId
   * @return {*}  {Promise<QuarantineRecord>}
   * @memberof QuarantineRepository
   */
  async getQuarantineRecord(quarantineId: string): Promise<QuarantineRecord> {
    const sqlStatement = SQL`
      SELECT
        quarantine_id,
        uri,
        status,
      FROM
        quarantine
      WHERE
        quarantine_id = ${quarantineId};
    `;

    const response = await this.connection.sql(sqlStatement, QuarantineRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get quarantine record', [
        'QuarantineRepository->getQuarantineRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new quarantine record.
   *
   * @param {IInsertQuarantine} quarantine
   * @return {*}  {Promise<{ quarantine_id: string }>}
   * @memberof QuarantineRepository
   */
  async insertQuarantineRecord(quarantine: IInsertQuarantine): Promise<{ quarantine_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.quarantine (
        uri,
        status
      ) VALUES (
        ${quarantine.uri ?? ''},
        ${quarantine.status ?? 'draft'}
      )
      RETURNING quarantine_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert quarantine record', [
        'QuarantineRepository->insertQuarantineRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing quarantine record.
   *
   * @param {string} quarantineId
   * @param {IUpdateQuarantine} quarantine
   * @return {*}  {Promise<{ quarantine_id: string }>}
   * @memberof QuarantineRepository
   */
  async updateQuarantineRecord(
    quarantineId: string,
    quarantine: IUpdateQuarantine
  ): Promise<{ quarantine_id: string }> {
    const sqlStatement = SQL`
    UPDATE biohub.quarantine
    SET
      uri = COALESCE(${quarantine.uri}, uri),
      status = COALESCE(${quarantine.status}, status)
    WHERE
      quarantine_id = ${quarantineId}
    RETURNING quarantine_id;
  `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update quarantine record', [
        'QuarantineRepository->updateQuarantineRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}
