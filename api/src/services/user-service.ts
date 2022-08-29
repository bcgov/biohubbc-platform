import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { Models } from '../models';
import { IGetRoles, UserRepository } from '../repositories/user-repository';
import { DBService } from './db-service';

export class UserService extends DBService {
  userRepository: UserRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.userRepository = new UserRepository(connection);
  }
  /**
   * Get all system roles in db
   *
   * @return {*}  {Promise<IGetRoles[]>}
   * @memberof UserService
   */
  async getRoles(): Promise<IGetRoles[]> {
    return this.userRepository.getRoles();
  }

  /**
   * Fetch a single system user by their ID.
   *
   * @param {number} systemUserId
   * @return {*}  {(Promise<Models.user.UserObject>)}
   * @memberof UserService
   */
  async getUserById(systemUserId: number): Promise<Models.user.UserObject> {
    const response = await this.userRepository.getUserById(systemUserId);

    return new Models.user.UserObject(response);
  }

  /**
   * Get an existing system user.
   *
   * @param {string} userIdentifier
   * @return {*}  {(Promise<Models.user.UserObject | null>)}
   * @memberof UserService
   */
  async getUserByIdentifier(userIdentifier: string): Promise<Models.user.UserObject | null> {
    const response = await this.userRepository.getUserByIdentifier(userIdentifier);

    if (response.length !== 1) {
      return null;
    }

    return new Models.user.UserObject(response[0]);
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
    const response = await this.userRepository.addSystemUser(userIdentifier, identitySource);

    return new Models.user.UserObject(response);
  }

  /**
   * Get a list of all system users.
   *
   * @return {*}  {Promise<Models.user.UserObject[]>}
   * @memberof UserService
   */
  async listSystemUsers(): Promise<Models.user.UserObject[]> {
    const response = await this.userRepository.listSystemUsers();

    return response.map((row) => new Models.user.UserObject(row));
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
    return this.getUserById(userObject.id);
  }

  /**
   * Activates an existing system user that had been deactivated (soft deleted).
   *
   * @param {number} systemUserId
   * @memberof UserService
   */
  async activateSystemUser(systemUserId: number) {
    await this.userRepository.activateSystemUser(systemUserId);
  }

  /**
   * Deactivates an existing system user (soft delete).
   *
   * @param {number} systemUserId
   * @memberof UserService
   */
  async deactivateSystemUser(systemUserId: number) {
    await this.userRepository.deactivateSystemUser(systemUserId);
  }

  /**
   * Delete all system roles for the user.
   *
   * @param {number} systemUserId
   * @memberof UserService
   */
  async deleteUserSystemRoles(systemUserId: number) {
    await this.userRepository.deleteUserSystemRoles(systemUserId);
  }

  /**
   * Adds the specified roleIds to the user.
   *
   * @param {number} systemUserId
   * @param {number[]} roleIds
   * @memberof UserService
   */
  async addUserSystemRoles(systemUserId: number, roleIds: number[]) {
    await this.userRepository.addUserSystemRoles(systemUserId, roleIds);
  }

  /**
   * Returns if the current system user is a system admin
   *
   * @return {*}  {Promise<boolean>}
   * @memberof UserService
   */
  async isSystemUserAdmin(): Promise<boolean> {
    const user = await this.getUserById(this.connection.systemUserId());
    return [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR].some((systemRole) =>
      user.role_names.includes(systemRole)
    );
  }
}
