import { ApiExecuteSQLError } from '../errors/api-error';
import { Models } from '../models';
import { Queries } from '../queries';
import { DBService } from './db-service';

export class UserService extends DBService {
  /**
   * Fetch a single system user by their ID.
   *
   * @param {number} systemUserId
   * @return {*}  {(Promise<Models.user.UserObject | null>)}
   * @memberof UserService
   */
  async getUserById(systemUserId: number): Promise<Models.user.UserObject | null> {
    const sqlStatement = Queries.users.getUserByIdSQL(systemUserId);

    const response = await this.connection.sql(sqlStatement);

    return (response?.rows?.[0] && new Models.user.UserObject(response.rows[0])) || null;
  }

  /**
   * Get an existing system user.
   *
   * @param {string} userIdentifier
   * @return {*}  {(Promise<Models.user.UserObject | null>)}
   * @memberof UserService
   */
  async getUserByIdentifier(userIdentifier: string): Promise<Models.user.UserObject | null> {
    const sqlStatement = Queries.users.getUserByUserIdentifierSQL(userIdentifier);

    const response = await this.connection.sql(sqlStatement);

    return (response?.rows?.[0] && new Models.user.UserObject(response.rows[0])) || null;
  }

  /**
   * Adds a new system user.
   *
   * Note: Will fail if the system user already exists.
   *
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @return {*}  {Promise<Models.user.UserObject>}
   * @memberof UserService
   */
  async addSystemUser(userIdentifier: string, identitySource: string): Promise<Models.user.UserObject> {
    const addSystemUserSQLStatement = Queries.users.addSystemUserSQL(userIdentifier, identitySource);

    const response = await this.connection.sql(addSystemUserSQLStatement);

    const userObject = (response?.rows?.[0] && new Models.user.UserObject(response.rows[0])) || null;

    if (!userObject) {
      throw new ApiExecuteSQLError('Failed to insert system user');
    }

    return userObject;
  }

  /**
   * Get a list of all system users.
   *
   * @return {*}  {Promise<Models.user.UserObject[]>}
   * @memberof UserService
   */
  async listSystemUsers(): Promise<Models.user.UserObject[]> {
    const getUserListSQLStatement = Queries.users.getUserListSQL();

    const getUserListResponse = await this.connection.sql(getUserListSQLStatement);

    return getUserListResponse.rows.map((row) => new Models.user.UserObject(row));
  }

  /**
   * Gets a system user, adding them if they do not already exist, or activating them if they had been deactivated (soft
   * deleted).
   *
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @param {IDBConnection} connection
   * @return {*}  {Promise<Models.user.UserObject>}
   * @memberof UserService
   */
  async ensureSystemUser(userIdentifier: string, identitySource: string): Promise<Models.user.UserObject> {
    // Check if the user exists
    let userObject = await this.getUserByIdentifier(userIdentifier);

    if (!userObject) {
      // Id of the current authenticated user
      const systemUserId = this.connection.systemUserId();

      if (!systemUserId) {
        throw new ApiExecuteSQLError('Failed to identify system user ID');
      }

      // Found no existing user, add them
      userObject = await this.addSystemUser(userIdentifier, identitySource);
    }

    if (!userObject.record_end_date) {
      // system user is already active
      return userObject;
    }

    // system user is not active, re-activate them
    await this.activateSystemUser(userObject.id);

    // get the newly activated user
    userObject = await this.getUserById(userObject.id);

    if (!userObject) {
      throw new ApiExecuteSQLError('Failed to ensure system user');
    }

    return userObject;
  }

  /**
   * Activates an existing system user that had been deactivated (soft deleted).
   *
   * @param {number} systemUserId
   * @return {*}  {(Promise<Models.user.UserObject>)}
   * @memberof UserService
   */
  async activateSystemUser(systemUserId: number) {
    const sqlStatement = Queries.users.activateSystemUserSQL(systemUserId);

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to activate system user');
    }
  }

  /**
   * Deactivates an existing system user (soft delete).
   *
   * @param {number} systemUserId
   * @return {*}  {(Promise<Models.user.UserObject>)}
   * @memberof UserService
   */
  async deactivateSystemUser(systemUserId: number) {
    const sqlStatement = Queries.users.deactivateSystemUserSQL(systemUserId);

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to deactivate system user');
    }
  }

  /**
   * Delete all system roles for the user.
   *
   * @param {number} systemUserId
   * @memberof UserService
   */
  async deleteUserSystemRoles(systemUserId: number) {
    const sqlStatement = Queries.users.deleteAllSystemRolesSQL(systemUserId);

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to delete user system roles');
    }
  }

  /**
   * Adds the specified roleIds to the user.
   *
   * @param {number} systemUserId
   * @param {number[]} roleIds
   * @memberof UserService
   */
  async addUserSystemRoles(systemUserId: number, roleIds: number[]) {
    const sqlStatement = Queries.users.postSystemRolesSQL(systemUserId, roleIds);

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to insert user system roles');
    }
  }
}
