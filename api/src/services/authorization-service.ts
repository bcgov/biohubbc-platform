import { SYSTEM_ROLE } from '../constants/roles';
import { IDBConnection } from '../database/db';
import { SystemUserExtended } from '../repositories/user-repository';
import { getServiceClientSystemUser, getUserGuid } from '../utils/keycloak-utils';
import { DBService } from './db-service';
import { UserService } from './user-service';

export enum AuthorizeOperator {
  AND = 'and',
  OR = 'or'
}

/**
 * Authorization rule that checks if a user's system role matches at least one of the required system roles.
 *
 * @export
 * @interface AuthorizeBySystemRoles
 */
export interface AuthorizeBySystemRoles {
  validSystemRoles: SYSTEM_ROLE[];
  discriminator: 'SystemRole';
}

/**
 * Authorization rule that checks if a user is a known and active user of the system.
 *
 * @export
 * @interface AuthorizeBySystemUser
 */
export interface AuthorizeBySystemUser {
  discriminator: 'SystemUser';
}

/**
 * Authorization rule that checks if a jwt token's client id matches at least one of the required client ids.
 *
 * Note: This is specifically for system-to-system communication.
 *
 * @export
 * @interface AuthorizeByServiceClient
 */
export interface AuthorizeByServiceClient {
  discriminator: 'ServiceClient';
}

export type AuthorizeRule = AuthorizeBySystemRoles | AuthorizeBySystemUser | AuthorizeByServiceClient;

export type AuthorizeConfigOr = {
  [AuthorizeOperator.AND]?: never;
  [AuthorizeOperator.OR]: AuthorizeRule[];
};

export type AuthorizeConfigAnd = {
  [AuthorizeOperator.AND]: AuthorizeRule[];
  [AuthorizeOperator.OR]?: never;
};

export type AuthorizationScheme = AuthorizeConfigAnd | AuthorizeConfigOr;

export class AuthorizationService extends DBService {
  _userService = new UserService(this.connection);
  _systemUser: SystemUserExtended | undefined = undefined;
  _keycloakToken: object | undefined = undefined;

  constructor(connection: IDBConnection, init?: { systemUser?: SystemUserExtended; keycloakToken?: object }) {
    super(connection);

    this._systemUser = init?.systemUser;
    this._keycloakToken = init?.keycloakToken;
  }

  get systemUser(): SystemUserExtended | undefined {
    return this._systemUser;
  }

  /**
   * Execute the `authorizationScheme` against the current user, and return `true` if they have access, `false` otherwise.
   *
   * @param {AuthorizationScheme} authorizationScheme
   * @return {*}  {Promise<boolean>} `true` if the `authorizationScheme` indicates the user has access, `false` otherwise.
   */
  async executeAuthorizationScheme(authorizationScheme: AuthorizationScheme): Promise<boolean> {
    if (authorizationScheme.and) {
      return (await this.executeAuthorizeConfig(authorizationScheme.and)).every((item) => item);
    } else {
      return (await this.executeAuthorizeConfig(authorizationScheme.or)).some((item) => item);
    }
  }

  /**
   * Execute an array of `AuthorizeRule`, returning an array of boolean results.
   *
   * @param {AuthorizeRule[]} authorizeRules
   * @return {*}  {Promise<boolean[]>}
   */
  async executeAuthorizeConfig(authorizeRules: AuthorizeRule[]): Promise<boolean[]> {
    const authorizeResults: boolean[] = [];

    for (const authorizeRule of authorizeRules) {
      switch (authorizeRule.discriminator) {
        case 'SystemRole':
          authorizeResults.push(await this.authorizeBySystemRole(authorizeRule));
          break;
        case 'SystemUser':
          authorizeResults.push(await this.authorizeBySystemUser());
          break;
        case 'ServiceClient':
          authorizeResults.push(await this.authorizeByServiceClient());
          break;
      }
    }

    return authorizeResults;
  }

  /**
   * Check if the user has the system administrator role.
   *
   * @return {*}  {boolean} `true` if the user is a system administrator, `false` otherwise.
   */
  async authorizeSystemAdministrator(): Promise<boolean> {
    const systemUserObject = this._systemUser || (await this.getSystemUserObject());

    if (!systemUserObject) {
      // Cannot verify user roles
      return false;
    }

    // Cache the _systemUser for future use, if needed
    this._systemUser = systemUserObject;

    return systemUserObject.role_names.includes(SYSTEM_ROLE.SYSTEM_ADMIN);
  }

  /**
   * Check that the user has at least one of the valid system roles specified in `authorizeSystemRoles.validSystemRoles`.
   *
   * @param {AuthorizeBySystemRoles} authorizeSystemRoles
   * @return {*}  {boolean} `true` if the user has at least one valid system role role, or no valid system roles are
   * specified; `false` otherwise.
   */
  async authorizeBySystemRole(authorizeSystemRoles: AuthorizeBySystemRoles): Promise<boolean> {
    if (!authorizeSystemRoles) {
      // Cannot verify user roles
      return false;
    }

    const systemUserObject = this._systemUser || (await this.getSystemUserObject());

    if (!systemUserObject) {
      // Cannot verify user roles
      return false;
    }

    // Cache the _systemUser for future use, if needed
    this._systemUser = systemUserObject;

    if (systemUserObject.record_end_date) {
      //system user has an expired record
      return false;
    }

    // Check if the user has at least 1 of the valid roles
    return AuthorizationService.hasAtLeastOneValidValue(
      authorizeSystemRoles.validSystemRoles,
      systemUserObject?.role_names
    );
  }

  /**
   * Check if the user is a valid system user.
   *
   * @return {*}  {Promise<boolean>} `Promise<true>` if the user is a valid system user, `Promise<false>` otherwise.
   */
  async authorizeBySystemUser(): Promise<boolean> {
    const systemUserObject = this._systemUser || (await this.getSystemUserObject());

    if (!systemUserObject) {
      // Cannot verify user roles
      return false;
    }

    // Cache the _systemUser for future use, if needed
    this._systemUser = systemUserObject;

    // User is a valid system user
    return true;
  }

  /**
   * Check if the user is a known service client system user.
   *
   * @return {*}  {Promise<boolean>} `Promise<true>` if the user is a known service client system user,
   * `Promise<false>` otherwise.
   */
  async authorizeByServiceClient(): Promise<boolean> {
    if (!this._keycloakToken) {
      // Cannot verify token source
      return false;
    }

    const source = getServiceClientSystemUser(this._keycloakToken);

    if (!source) {
      // Failed to find known service client system user
      return false;
    }

    return true;
  }

  /**
   * Compares an array of incoming values against an array of valid values.
   *
   * @param {(string | string[])} validValues valid values to match against
   * @param {(string | string[])} incomingValues incoming values to check against the valid values
   * @return {*} {boolean} true if the incomingValues has at least 1 of the validValues or no valid values are
   * specified, false otherwise
   */
  static hasAtLeastOneValidValue = function (
    validValues: string | string[],
    incomingValues: string | string[]
  ): boolean {
    if (!validValues || !validValues.length) {
      return true;
    }

    if (!Array.isArray(validValues)) {
      validValues = [validValues];
    }

    if (!Array.isArray(incomingValues)) {
      incomingValues = [incomingValues];
    }

    for (const validRole of validValues) {
      if (incomingValues.includes(validRole)) {
        return true;
      }
    }

    return false;
  };

  async getSystemUserObject(): Promise<SystemUserExtended | null> {
    let systemUserWithRoles;

    try {
      systemUserWithRoles = await this.getSystemUserWithRoles();
    } catch {
      return null;
    }

    if (!systemUserWithRoles) {
      return null;
    }

    return systemUserWithRoles;
  }

  /**
   * Finds a single user based on their keycloak token information.
   *
   * @return {*}  {(Promise<SystemUserExtended | null>)}
   */
  async getSystemUserWithRoles(): Promise<SystemUserExtended | null> {
    if (!this._keycloakToken) {
      return null;
    }

    const userGuid = getUserGuid(this._keycloakToken);

    if (!userGuid) {
      return null;
    }

    return this._userService.getUserByGuid(userGuid);
  }
}
