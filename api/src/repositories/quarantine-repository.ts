// quarantine-repository.ts
import { SQL } from 'sql-template-strings';
import { ApiGeneralError } from '../errors/api-error';
import { IInsertQuarantine, IUpdateQuarantine } from '../models/quarantine';
import { BaseRepository } from './base-repository';

export class QuarantineRepository extends BaseRepository {
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
        status,
        create_user
      ) VALUES (
        ${quarantine.uri ?? ''},
        ${quarantine.status ?? 'draft'},
        (SELECT system_user_id FROM biohub.system_user WHERE user_identifier = CURRENT_USER)
      )
      RETURNING quarantine_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiGeneralError('Failed to insert quarantine record');
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
    const updates: string[] = [];
    const sqlStatement = SQL`UPDATE biohub.quarantine SET `;

    if (quarantine.uri !== undefined) {
      updates.push('uri = ');
      sqlStatement.append(SQL`uri = ${quarantine.uri}`);
    }

    if (quarantine.status !== undefined) {
      if (updates.length) {
        sqlStatement.append(SQL`, `);
      }
      updates.push('status');
      sqlStatement.append(SQL`status = ${quarantine.status}`);
    }

    if (!updates.length) {
      throw new ApiGeneralError('No fields to update');
    }

    sqlStatement.append(SQL`,
      update_date = now(),
      update_user = (SELECT system_user_id FROM biohub.system_user WHERE user_identifier = CURRENT_USER),
      revision_count = revision_count + 1
    WHERE
      quarantine_id = ${quarantineId}
    RETURNING quarantine_id;
    `);

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiGeneralError('Failed to update quarantine record');
    }

    return response.rows[0];
  }
}
