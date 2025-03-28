import SQL from 'sql-template-strings';
import { z } from 'zod';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';

export const SystemUser = z.object({
  system_user_id: z.number(),
  user_identity_source_id: z.number(),
  user_identifier: z.string(),
  user_guid: z.string(),
  record_effective_date: z.string(),
  record_end_date: z.string().nullable(),
  create_date: z.string(),
  create_user: z.number(),
  update_date: z.string().nullable(),
  update_user: z.number().nullable(),
  revision_count: z.number()
});

export type SystemUser = z.infer<typeof SystemUser>;

export const SystemUserExtended = SystemUser.extend({
  identity_source: z.string(),
  role_ids: z.array(z.number()),
  role_names: z.array(z.string())
});

export type SystemUserExtended = z.infer<typeof SystemUserExtended>;

const SystemRoles = z.object({
  system_role_id: z.number(),
  name: z.string()
});

export type SystemRoles = z.infer<typeof SystemRoles>;

export class UserRepository extends BaseRepository {
  /**
   * Get all system roles in db
   *
   * @return {*}  {Promise<SystemRoles[]>}
   * @memberof UserRepository
   */
  async getRoles(): Promise<SystemRoles[]> {
    const sqlStatement = SQL`
      SELECT
        sr.system_role_id,
        sr.name
      FROM
        system_role sr
    `;

    const response = await this.connection.sql(sqlStatement, SystemRoles);

    return response.rows;
  }

  /**
   * Fetch a single system user by their system user ID.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<SystemUserExtended>}
   * @memberof UserRepository
   */
  async getUserById(systemUserId: number): Promise<SystemUserExtended> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "system_user" su
      LEFT JOIN
        system_user_role sur
      ON
        su.system_user_id = sur.system_user_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
        user_identity_source uis
      ON
        uis.user_identity_source_id = su.user_identity_source_id
      WHERE
        su.system_user_id = ${systemUserId}
      AND
        su.record_end_date IS NULL
      GROUP BY
        su.system_user_id,
        su.user_identity_source_id,
        su.user_identifier,
        su.user_guid,
        su.record_effective_date,
        su.record_end_date,
        su.create_date,
        su.create_user,
        su.update_date,
        su.update_user,
        su.revision_count,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, SystemUserExtended);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get user by id', [
        'UserRepository->getUserById',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get an existing system user by their GUID.
   *
   * @param {string} userGuid the user's GUID
   * @return {*}  {Promise<SystemUserExtended>}
   * @memberof UserRepository
   */
  async getUserByGuid(userGuid: string): Promise<SystemUserExtended[]> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "system_user" su
      LEFT JOIN
        system_user_role sur
      ON
        su.system_user_id = sur.system_user_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
        user_identity_source uis
      ON
        uis.user_identity_source_id = su.user_identity_source_id
      WHERE
        su.user_guid = ${userGuid}
      GROUP BY
        su.system_user_id,
        su.user_identity_source_id,
        su.user_identifier,
        su.user_guid,
        su.record_effective_date,
        su.record_end_date,
        su.create_date,
        su.create_user,
        su.update_date,
        su.update_user,
        su.revision_count,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, SystemUserExtended);

    return response.rows;
  }

  /**
   * Get an existing system user by their user identifier and identity source.
   *
   * @param userIdentifier the user's identifier
   * @param identitySource the user's identity source, e.g. `'IDIR'`
   * @return {*}  {Promise<SystemUserExtended[]>} Promise resolving an array containing the user, if they match the
   * search criteria.
   * @memberof UserService
   */
  async getUserByIdentifier(userIdentifier: string, identitySource: string): Promise<SystemUserExtended[]> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "system_user" su
      LEFT JOIN
        system_user_role sur
      ON
        su.system_user_id = sur.system_user_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
        user_identity_source uis
      ON
        uis.user_identity_source_id = su.user_identity_source_id
      WHERE
        LOWER(su.user_identifier) = ${userIdentifier.toLowerCase()}
      AND
        uis.name = ${identitySource.toUpperCase()}
      GROUP BY
        su.system_user_id,
        su.user_identity_source_id,
        su.user_identifier,
        su.user_guid,
        su.record_effective_date,
        su.record_end_date,
        su.create_date,
        su.create_user,
        su.update_date,
        su.update_user,
        su.revision_count,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, SystemUserExtended);

    return response.rows;
  }

  /**
   * Adds a new system user.
   *
   * Note: Will fail if the system user already exists.
   *
   * @param {string} userGuid
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @return {*}  {Promise<SystemUser>}
   * @memberof UserRepository
   */
  async addSystemUser(userGuid: string, userIdentifier: string, identitySource: string): Promise<SystemUser> {
    const sqlStatement = SQL`
      INSERT INTO
        "system_user"
      (
        user_guid,
        user_identity_source_id,
        user_identifier,
        record_effective_date
      )
      VALUES (
        ${userGuid},
        (
          SELECT
            user_identity_source_id
          FROM
            user_identity_source
          WHERE
            name = ${identitySource.toUpperCase()}
        ),
        ${userIdentifier},
        now()
      )
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement, SystemUser);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert new user', [
        'UserRepository->addSystemUser',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a list of all system users.
   *
   * @return {*}  {Promise<SystemUserExtended[]>}
   * @memberof UserRepository
   */
  async listSystemUsers(): Promise<SystemUserExtended[]> {
    const sqlStatement = SQL`
      SELECT
        su.*,
        uis.name AS identity_source,
        array_remove(array_agg(sr.system_role_id), NULL) AS role_ids,
        array_remove(array_agg(sr.name), NULL) AS role_names
      FROM
        "system_user" su
      LEFT JOIN
        system_user_role sur
      ON
        su.system_user_id = sur.system_user_id
      LEFT JOIN
        system_role sr
      ON
        sur.system_role_id = sr.system_role_id
      LEFT JOIN
      	user_identity_source uis
      ON
      	su.user_identity_source_id = uis.user_identity_source_id
      WHERE
        su.record_end_date IS NULL AND uis.name not in (${SYSTEM_IDENTITY_SOURCE.DATABASE}, ${SYSTEM_IDENTITY_SOURCE.SYSTEM})
      GROUP BY
        su.system_user_id,
        su.user_identity_source_id,
        su.user_identifier,
        su.user_guid,
        su.record_effective_date,
        su.record_end_date,
        su.create_date,
        su.create_user,
        su.update_date,
        su.update_user,
        su.revision_count,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, SystemUserExtended);

    return response.rows;
  }

  /**
   * Activates an existing system user that had been deactivated (soft deleted).
   *
   * @param {number} systemUserId
   * @memberof UserRepository
   */
  async activateSystemUser(systemUserId: number) {
    const sqlStatement = SQL`
      UPDATE
        "system_user"
      SET
        record_end_date = NULL
      WHERE
        system_user_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to activate system user', [
        'UserRepository->activateSystemUser',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Deactivates an existing system user (soft delete).
   *
   * @param {number} systemUserId
   * @memberof UserRepository
   */
  async deactivateSystemUser(systemUserId: number) {
    const sqlStatement = SQL`
      UPDATE
        "system_user"
      SET
        record_end_date = now()
      WHERE
        system_user_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to deactivate system user', [
        'UserRepository->deactivateSystemUser',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Delete all system roles for the user.
   *
   * @param {number} systemUserId
   * @memberof UserRepository
   */
  async deleteUserSystemRoles(systemUserId: number) {
    const sqlStatement = SQL`
      DELETE FROM
        system_user_role
      WHERE
        system_user_id = ${systemUserId}
      RETURNING
        *;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Adds the specified roleIds to the user.
   *
   * @param {number} systemUserId
   * @param {number[]} roleIds
   * @memberof UserRepository
   */
  async addUserSystemRoles(systemUserId: number, roleIds: number[]) {
    const sqlStatement = SQL`
      INSERT INTO system_user_role (
        system_user_id,
        system_role_id
      ) VALUES `;

    roleIds.forEach((roleId, index) => {
      sqlStatement.append(SQL`
        (${systemUserId},${roleId})
      `);

      if (index !== roleIds.length - 1) {
        sqlStatement.append(',');
      }
    });

    sqlStatement.append(';');

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to insert user system roles', [
        'UserRepository->addUserSystemRoles',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
