import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { SystemRoles, SystemUser, SystemUserExtended, UserRepository } from '../repositories/user-repository';
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
   * @return {*}  {Promise<SystemRoles[]>}
   * @memberof UserService
   */
  async getRoles(): Promise<SystemRoles[]> {
    return this.userRepository.getRoles();
  }

  /**
   * Fetch a single system user by their system user ID.
   *
   * @param {number} systemUserId
   * @return {*}  {Promise<SystemUserExtended>}
   * @memberof UserService
   */
  async getUserById(systemUserId: number): Promise<SystemUserExtended> {
    return this.userRepository.getUserById(systemUserId);
  }

  /**
   * Get an existing system user by their GUID.
   *
   * @param {string} userGuid The user's GUID
   * @return {*}  {(Promise<SystemUserExtended | null>)}
   * @memberof UserService
   */
  async getUserByGuid(userGuid: string): Promise<SystemUserExtended | null> {
    const response = await this.userRepository.getUserByGuid(userGuid);

    if (response.length !== 1) {
      return null;
    }

    return response[0];
  }

  /**
   * Get an existing system user by their user identifier and identity source.
   *
   * @param userIdentifier the user's identifier
   * @param identitySource the user's identity source, e.g. `'IDIR'`
   * @return {*}  {(Promise<SystemUserExtended | null>)} Promise resolving the User, or `null` if the user wasn't found.
   * @memberof UserService
   */
  async getUserByIdentifier(userIdentifier: string, identitySource: string): Promise<SystemUserExtended | null> {
    const response = await this.userRepository.getUserByIdentifier(userIdentifier, identitySource);

    if (response.length !== 1) {
      return null;
    }

    return response[0];
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
   * @memberof UserService
   */
  async addSystemUser(userGuid: string, userIdentifier: string, identitySource: string): Promise<SystemUser> {
    return this.userRepository.addSystemUser(userGuid, userIdentifier, identitySource);
  }

  /**
   * Get a list of all system users.
   *
   * @return {*}  {Promise<SystemUserExtended[]>}
   * @memberof UserService
   */
  async listSystemUsers(): Promise<SystemUserExtended[]> {
    return this.userRepository.listSystemUsers();
  }

  /**
   * Gets a system user, adding them if they do not already exist, or activating them if they had been deactivated (soft
   * deleted).
   *
   * @param {string} userGuid
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @return {*}  {Promise<SystemUserExtended>}
   * @memberof UserService
   */
  async ensureSystemUser(
    userGuid: string,
    userIdentifier: string,
    identitySource: string
  ): Promise<SystemUserExtended> {
    // Check if the user exists in BioHub
    const existingUser = userGuid
      ? await this.getUserByGuid(userGuid)
      : await this.getUserByIdentifier(userIdentifier, identitySource);

    if (!existingUser) {
      // Id of the current authenticated user
      const systemUserId = this.connection.systemUserId();

      if (!systemUserId) {
        throw new ApiExecuteSQLError('Failed to identify system user ID');
      }

      // Found no existing user, add them
      const newUserId = await this.addSystemUser(userGuid, userIdentifier, identitySource);

      // fetch the new user object
      return this.getUserById(newUserId.system_user_id);
    }

    if (!existingUser.record_end_date) {
      // system user is already active
      return existingUser;
    }

    // system user is not active, re-activate them
    await this.activateSystemUser(existingUser.system_user_id);

    // get the newly activated user
    return this.getUserById(existingUser.system_user_id);
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
