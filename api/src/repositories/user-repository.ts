import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  AvailableUser,
  IAddSystemUserParams,
  IUpdateSystemUserParams,
  SystemRoles,
  SystemUser,
  SystemUserExtended
} from '../models/system-user';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

/**
 * Maximum number of users to return in getAvailableUsers.
 */
const MAX_AVAILABLE_USERS_LIMIT = 50;

/**
 * Identity sources to exclude from user administration lists.
 */
const EXCLUDED_USER_ADMIN_IDENTITY_SOURCES = [SYSTEM_IDENTITY_SOURCE.SYSTEM, SYSTEM_IDENTITY_SOURCE.DATABASE];

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
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
        uis.name;
    `;

    const response = await this.connection.sql(sqlStatement, SystemUserExtended);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('User not found', ['UserRepository->getUserById', { systemUserId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'UserRepository->getUserById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
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
        LOWER(su.user_guid) = ${userGuid.toLowerCase()}
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
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
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
        su.display_name,
        su.given_name,
        su.family_name,
        su.email,
        su.agency,
        su.notes,
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
   * @param {IAddSystemUserParams} params - The user parameters
   * @return {*}  {Promise<SystemUser>}
   * @memberof UserRepository
   */
  async addSystemUser(params: IAddSystemUserParams): Promise<SystemUser> {
    const sqlStatement = SQL`
      INSERT INTO
        "system_user"
      (
        user_guid,
        user_identity_source_id,
        user_identifier,
        record_effective_date,
        display_name,
        email,
        given_name,
        family_name,
        agency
      )
      VALUES (
        ${params.userGuid.toLowerCase()},
        (
          SELECT
            user_identity_source_id
          FROM
            user_identity_source
          WHERE
            name = ${params.identitySource.toUpperCase()}
        ),
        ${params.userIdentifier},
        now(),
        ${params.displayName ?? null},
        ${params.email ?? null},
        ${params.givenName ?? null},
        ${params.familyName ?? null},
        ${params.agency ?? null}
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
   * Get a paginated list of all non-system and non-database system users.
   *
   * @param {string} [search] - Optional search term to filter users by identifier, display name, email, or identity source.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting options.
   * @return {*}  {Promise<SystemUserExtended[]>}
   * @memberof UserRepository
   */
  async listSystemUsers(search?: string, pagination?: ApiPaginationOptions): Promise<SystemUserExtended[]> {
    const knex = getKnex();
    let query = knex
      .table('system_user as su')
      .select(
        'su.*',
        'uis.name as identity_source',
        knex.raw('array_remove(array_agg(sr.system_role_id), NULL) AS role_ids'),
        knex.raw('array_remove(array_agg(sr.name), NULL) AS role_names')
      )
      .leftJoin('system_user_role as sur', 'su.system_user_id', 'sur.system_user_id')
      .leftJoin('system_role as sr', 'sur.system_role_id', 'sr.system_role_id')
      .leftJoin('user_identity_source as uis', 'su.user_identity_source_id', 'uis.user_identity_source_id')
      .whereNotIn('uis.name', EXCLUDED_USER_ADMIN_IDENTITY_SOURCES)
      .groupBy(
        'su.system_user_id',
        'su.user_identity_source_id',
        'su.user_identifier',
        'su.user_guid',
        'su.record_effective_date',
        'su.record_end_date',
        'su.create_date',
        'su.create_user',
        'su.update_date',
        'su.update_user',
        'su.revision_count',
        'su.display_name',
        'su.given_name',
        'su.family_name',
        'su.email',
        'su.agency',
        'su.notes',
        'uis.name'
      );

    query = this.applySystemUserSearch(query, search);
    query = this.applySystemUserPagination(query, pagination);

    const response = await this.connection.knex(query, SystemUserExtended);

    return response.rows;
  }

  /**
   * Count all non-system and non-database system users.
   *
   * @param {string} [search] - Optional search term to filter users by identifier, display name, email, or identity source.
   * @return {*}  {Promise<number>}
   * @memberof UserRepository
   */
  async getSystemUsersCount(search?: string): Promise<number> {
    const knex = getKnex();
    let query = knex
      .table('system_user as su')
      .leftJoin('user_identity_source as uis', 'su.user_identity_source_id', 'uis.user_identity_source_id')
      .whereNotIn('uis.name', EXCLUDED_USER_ADMIN_IDENTITY_SOURCES)
      .select(knex.raw('count(*)::integer as count'));

    query = this.applySystemUserSearch(query, search);

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
  }

  /**
   * Apply the supported user search filter to a system user query.
   *
   * @param {Knex.QueryBuilder} query - Base system user query.
   * @param {string} [search] - Optional search term to filter users by identifier, display name, email, or identity source.
   * @return {*}  {Knex.QueryBuilder}
   * @memberof UserRepository
   */
  private applySystemUserSearch(query: Knex.QueryBuilder, search?: string): Knex.QueryBuilder {
    if (!search) {
      return query;
    }

    const term = `%${search.toLowerCase()}%`;

    query.andWhere((builder) => {
      builder
        .whereRaw('LOWER(su.user_identifier) LIKE ?', [term])
        .orWhereRaw('LOWER(su.display_name) LIKE ?', [term])
        .orWhereRaw('LOWER(su.email) LIKE ?', [term])
        .orWhereRaw('LOWER(uis.name) LIKE ?', [term]);
    });

    return query;
  }

  /**
   * Apply pagination and supported sorting to a system user query.
   *
   * @param {Knex.QueryBuilder} query - Base system user query.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination and sorting options.
   * @return {*}  {Knex.QueryBuilder}
   * @memberof UserRepository
   */
  private applySystemUserPagination(query: Knex.QueryBuilder, pagination?: ApiPaginationOptions): Knex.QueryBuilder {
    const sortColumns: Record<string, string> = {
      system_user_id: 'su.system_user_id',
      user_identifier: 'su.user_identifier',
      identity_source: 'uis.name',
      record_end_date: 'su.record_end_date',
      create_date: 'su.create_date'
    };

    if (pagination?.sort && pagination.order && sortColumns[pagination.sort]) {
      query.orderBy(sortColumns[pagination.sort], pagination.order);
    } else {
      query.orderBy('su.user_identifier', 'asc');
    }

    if (pagination?.limit) {
      query.limit(pagination.limit);
    }

    if (pagination?.page && pagination.limit) {
      query.offset((pagination.page - 1) * pagination.limit);
    }

    return query;
  }

  /**
   * Updates a system user.
   *
   * @param {number} systemUserId
   * @param {IUpdateSystemUserParams} updates
   * @memberof UserRepository
   */
  async updateSystemUser(systemUserId: number, updates: IUpdateSystemUserParams) {
    const sqlStatement = SQL`
      UPDATE
        "system_user"
      SET
        record_end_date = ${updates.record_end_date}
      WHERE
        system_user_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update system user', [
        'UserRepository->updateSystemUser',
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

  /**
   * Get available users for team membership (excludes SYSTEM and DATABASE users).
   *
   * @param {string} [search] - Optional search term to filter by user_identifier or display_name.
   * @return {Promise<AvailableUser[]>}
   * @memberof UserRepository
   */
  async getAvailableUsers(search?: string): Promise<AvailableUser[]> {
    const knex = getKnex();
    const query = knex
      .table('system_user as su')
      .select(['su.system_user_id', 'su.user_identifier', 'su.display_name'])
      .innerJoin('user_identity_source as uis', 'su.user_identity_source_id', 'uis.user_identity_source_id')
      .whereNull('su.record_end_date')
      .whereNotIn('uis.name', [SYSTEM_IDENTITY_SOURCE.SYSTEM, SYSTEM_IDENTITY_SOURCE.DATABASE])
      .orderByRaw('COALESCE(su.display_name, su.user_identifier) ASC')
      .limit(MAX_AVAILABLE_USERS_LIMIT);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query.where((builder) => builder.whereILike('su.user_identifier', term).orWhereILike('su.display_name', term));
    }

    const response = await this.connection.knex(query, AvailableUser);
    return response.rows;
  }

  /**
   * Updates a system user's profile fields.
   *
   * @param {number} systemUserId - The ID of the user to update
   * @param {string | null} displayName - User's display name
   * @param {string | null} email - User's email
   * @param {string | null} givenName - User's first name
   * @param {string | null} familyName - User's last name
   * @param {string | null} agency - User's organization (BCeID Business only)
   * @return {*}  {Promise<void>}
   * @memberof UserRepository
   */
  async updateSystemUserProfile(
    systemUserId: number,
    displayName: string | null,
    email: string | null,
    givenName: string | null,
    familyName: string | null,
    agency: string | null
  ): Promise<void> {
    const sqlStatement = SQL`
      UPDATE
        "system_user"
      SET
        display_name = ${displayName},
        email = ${email},
        given_name = ${givenName},
        family_name = ${familyName},
        agency = ${agency}
      WHERE
        system_user_id = ${systemUserId}
      RETURNING
        *;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update system user profile', [
        'UserRepository->updateSystemUserProfile',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}
