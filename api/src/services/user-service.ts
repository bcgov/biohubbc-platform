import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
import { HTTP401 } from '../errors/http-error';
import { isSystemUserInactive } from '../models/user';
import {
  AvailableUser,
  IAddSystemUserParams,
  SystemRoles,
  SystemUser,
  SystemUserExtended,
  UserRepository
} from '../repositories/user-repository';
import { DBService } from './db-service';

/**
 * User profile fields from Keycloak token.
 */
export interface IUserProfile {
  displayName: string | null;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
  agency: string | null;
}

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
   * @param {IUserProfile} [profile] - Optional user profile fields from Keycloak
   * @return {*}  {Promise<SystemUser>}
   * @memberof UserService
   */
  async addSystemUser(
    userGuid: string,
    userIdentifier: string,
    identitySource: string,
    profile?: IUserProfile
  ): Promise<SystemUser> {
    const params: IAddSystemUserParams = {
      userGuid,
      userIdentifier,
      identitySource,
      displayName: profile?.displayName,
      email: profile?.email,
      givenName: profile?.givenName,
      familyName: profile?.familyName,
      agency: profile?.agency
    };
    return this.userRepository.addSystemUser(params);
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

  /**
   * Get available users for team membership (excludes SYSTEM and DATABASE users).
   *
   * @param {string} [search] - Optional search term to filter by user_identifier.
   * @return {Promise<AvailableUser[]>}
   * @memberof UserService
   */
  async getAvailableUsers(search?: string): Promise<AvailableUser[]> {
    return this.userRepository.getAvailableUsers(search);
  }

  /**
   * Adds a new system user and assigns them the specified role.
   *
   * @param {string} userGuid - The user's Keycloak GUID
   * @param {string} userIdentifier - The user's identifier (e.g., IDIR username)
   * @param {string} identitySource - The user's identity source (e.g., 'IDIR')
   * @param {string} roleName - The name of the role to assign (e.g., 'Member')
   * @param {IUserProfile} [profile] - Optional user profile fields from Keycloak
   * @return {*}  {Promise<SystemUserExtended>}
   * @memberof UserService
   */
  async addSystemUserWithRole(
    userGuid: string,
    userIdentifier: string,
    identitySource: string,
    roleName: string,
    profile?: IUserProfile
  ): Promise<SystemUserExtended> {
    // 1. Insert new system_user record with profile fields
    const newUser = await this.addSystemUser(userGuid, userIdentifier, identitySource, profile);

    // 2. Get role ID for the specified role
    const roles = await this.getRoles();
    const role = roles.find((r) => r.name === roleName);

    if (!role) {
      throw new ApiExecuteSQLError(`Failed to find role: ${roleName}`);
    }

    // 3. Assign role to user
    await this.addUserSystemRoles(newUser.system_user_id, [role.system_role_id]);

    // 4. Return user with roles
    return this.getUserById(newUser.system_user_id);
  }

  /**
   * Updates a system user's profile fields.
   *
   * @param {number} systemUserId - The ID of the user to update
   * @param {IUserProfile} profile - The profile fields to update
   * @return {*}  {Promise<void>}
   * @memberof UserService
   */
  async updateSystemUserProfile(systemUserId: number, profile: IUserProfile): Promise<void> {
    await this.userRepository.updateSystemUserProfile(
      systemUserId,
      profile.displayName,
      profile.email,
      profile.givenName,
      profile.familyName,
      profile.agency
    );
  }

  /**
   * Upserts the current user (self) based on Keycloak token data.
   *
   * - If user doesn't exist: creates with Member role
   * - If user exists and is active: updates profile fields
   * - If user exists but is expired: throws HTTP 401
   *
   * @param {string} userGuid - The user's Keycloak GUID
   * @param {string} userIdentifier - The user's identifier (e.g., IDIR username)
   * @param {string} identitySource - The user's identity source (e.g., 'IDIR')
   * @param {IUserProfile} profile - User profile fields from Keycloak token
   * @return {*}  {Promise<{ user: SystemUserExtended; created: boolean }>}
   * @memberof UserService
   */
  async upsertSelf(
    userGuid: string,
    userIdentifier: string,
    identitySource: string,
    profile: IUserProfile
  ): Promise<{ user: SystemUserExtended; created: boolean }> {
    // Look up user by GUID
    const existingUser = await this.getUserByGuid(userGuid);

    if (!existingUser) {
      // User doesn't exist - create with Member role
      const newUser = await this.addSystemUserWithRole(
        userGuid,
        userIdentifier,
        identitySource,
        SYSTEM_ROLE.MEMBER,
        profile
      );
      return { user: newUser, created: true };
    }

    // User exists - check if soft-deleted (inactive)
    if (isSystemUserInactive(existingUser)) {
      throw new HTTP401('User account is expired or inactive');
    }

    // User exists and is active - update profile fields
    await this.updateSystemUserProfile(existingUser.system_user_id, profile);

    // Return updated user
    const updatedUser = await this.getUserById(existingUser.system_user_id);
    return { user: updatedUser, created: false };
  }
}
