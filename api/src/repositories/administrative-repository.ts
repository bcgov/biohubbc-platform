import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';

export interface IAdministrativeActivity {
  id: number;
  type: number;
  type_name: string;
  status: number;
  status_name: string;
  description: string;
  notes: string;
  data: string;
  create_date: string;
}

export interface ICreateAdministrativeActivity {
  id: number;
  create_date: string;
}

export class AdministrativeRepository extends BaseRepository {
  /**
   * Get all Administrative Activities
   *
   * @param {string} administrativeActivityTypeName
   * @param {string[]} administrativeActivityStatusTypes
   * @return {*}  {Promise<IAdministrativeActivity[]>}
   * @memberof AdministrativeRepository
   */
  async getAdministrativeActivities(
    administrativeActivityTypeName: string,
    administrativeActivityStatusTypes: string[]
  ): Promise<IAdministrativeActivity[]> {
    //TODO: turn sql to knex query
    const sqlStatement = SQL`
      SELECT
        aa.administrative_activity_id as id,
        aat.administrative_activity_type_id as type,
        aat.name as type_name,
        aast.administrative_activity_status_type_id as status,
        aast.name as status_name,
        aa.description,
        aa.data,
        aa.notes,
        aa.create_date
      FROM
        administrative_activity aa
      LEFT OUTER JOIN
        administrative_activity_status_type aast
      ON
        aa.administrative_activity_status_type_id = aast.administrative_activity_status_type_id
      LEFT OUTER JOIN
        administrative_activity_type aat
      ON
        aa.administrative_activity_type_id = aat.administrative_activity_type_id
      WHERE
        1 = 1
  `;

    if (administrativeActivityTypeName) {
      sqlStatement.append(SQL`
      AND
        aat.name = ${administrativeActivityTypeName}
    `);
    }

    if (administrativeActivityStatusTypes?.length) {
      sqlStatement.append(SQL`
      AND
        aast.name IN (
    `);

      // Add first element
      sqlStatement.append(SQL`${administrativeActivityStatusTypes[0]}`);

      for (let idx = 1; idx < administrativeActivityStatusTypes.length; idx++) {
        // Add subsequent elements, which get a comma prefix
        sqlStatement.append(SQL`, ${administrativeActivityStatusTypes[idx]}`);
      }

      sqlStatement.append(SQL`)`);
    }

    sqlStatement.append(`;`);

    const response = await this.connection.sql<IAdministrativeActivity>(sqlStatement);

    if (response.rowCount <= 0) {
      throw new ApiExecuteSQLError('Failed to get Administrative activities', [
        'AdministrativeRepository->getAdministrativeActivities',
        'rowCount was null or undefined, expected rowCount >= 1'
      ]);
    }

    const result = (response && response.rowCount && response.rows) || [];

    return result;
  }

  /**
   * Check access request if actioned
   *
   * @param {number} adminActivityTypeId
   * @return {*}  {Promise<boolean>}
   * @memberof AdministrativeRepository
   */
  async checkIfAccessRequestIsApproval(adminActivityTypeId: number): Promise<boolean> {
    const adminActivityStatusTypeSQLStatment = SQL`
      SELECT
        *
      FROM
        administrative_activity_status_type
      WHERE
        administrative_activity_status_type_id = ${adminActivityTypeId};
    `;

    const response = await this.connection.sql(adminActivityStatusTypeSQLStatment);

    if (response.rows?.[0]?.name === 'Actioned') {
      return true;
    }
    return false;
  }

  /**
   * Create Administrative Activity
   *
   * @param {number} systemUserId
   * @param {*} data
   * @return {*}  {Promise<ICreateAdministrativeActivity>}
   * @memberof AdministrativeRepository
   */
  async createAdministrativeActivity(systemUserId: number, data: any): Promise<ICreateAdministrativeActivity> {
    const postAdministrativeActivitySQLStatement = SQL`
      INSERT INTO administrative_activity (
        reported_system_user_id,
        administrative_activity_type_id,
        administrative_activity_status_type_id,
        data
      ) VALUES (
        ${systemUserId},
        1,
        1,
        ${data}
      )
      RETURNING
        administrative_activity_id as id,
        create_date::timestamptz;
  `;

    const response = await this.connection.sql<ICreateAdministrativeActivity>(postAdministrativeActivitySQLStatement);

    const result = (response && response.rows && response.rows[0]) || null;

    if (!result || !result.id) {
      throw new ApiExecuteSQLError('Failed to submit administrative activity');
    }

    return result;
  }

  /**
   * Get count of pending access requests
   *
   * @param {string} userIdentifier
   * @return {*}  {Promise<number>}
   * @memberof AdministrativeRepository
   */
  async getPendingAccessRequestCount(userIdentifier: string): Promise<number> {
    const sqlStatement = SQL`
      SELECT
        *
      FROM
        administrative_activity aa
      LEFT OUTER JOIN
        administrative_activity_status_type aast
      ON
        aa.administrative_activity_status_type_id = aast.administrative_activity_status_type_id
        WHERE
        (aa.data -> 'username')::text =  '"' || ${userIdentifier} || '"'
      AND aast.name = 'Pending';
    `;

    const response = await this.connection.sql(sqlStatement);

    const result = (response && response.rowCount) || 0;

    return result;
  }

  /**
   * Update an existing administrative activity.
   *
   * @param {number} administrativeActivityId
   * @param {number} administrativeActivityStatusTypeId
   * @param {IDBConnection} connection
   */
  async updateAdministrativeActivity(
    administrativeActivityId: number,
    administrativeActivityStatusTypeId: number
  ): Promise<{ id: number }> {
    const sqlStatement = SQL`
      UPDATE
        administrative_activity
      SET
        administrative_activity_status_type_id = ${administrativeActivityStatusTypeId}
      WHERE
        administrative_activity_id = ${administrativeActivityId}
      RETURNING
        administrative_activity_id as id;
  `;

    const response = await this.connection.sql<{ id: number }>(sqlStatement);

    const result = (response && response.rowCount && response.rows[0]) || null;

    if (!result) {
      throw new ApiExecuteSQLError('Failed to update administrative activity');
    }

    return result;
  }
}
