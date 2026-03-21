import dayjs from 'dayjs';
import { SYSTEM_ROLE } from '../../constants/roles';
import { IDBConnection } from '../../database/db';
import { SystemUser, SystemUserExtended } from '../../repositories/user-repository';
import { getUserGuid } from '../../utils/keycloak-utils';
import { CartService } from '../cart-service';
import { ContributorSystemUserService } from '../contributor-system-user-service';
import { DBService } from '../db-service';
import { UserService } from '../user-service';
import { TeamAuthorizationService } from './team-authorization-service';

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
 * Team-scoped entity reference used by Team authorization checks.
 *
 * @export
 */
export type TeamAuthorizationEntity =
  | {
      entity: 'data_request';
      dataRequestId: string;
    }
  | {
      entity: 'submission_feature';
      submissionFeatureId: number;
      submissionId: number;
    };

export type AuthorizeByTeam = TeamAuthorizationEntity & {
  discriminator: 'Team';
};

/**
 * Authorization rule that checks if a jwt token maps to a known contributor by client id.
 *
 * @export
 * @interface AuthorizeByContributor
 */
export interface AuthorizeByContributor {
  discriminator: 'Contributor';
}

/**
 * Authorization rule that checks if the cart belongs to the system user.
 *
 * @export
 * @interface AuthorizeByCart
 */
export interface AuthorizeByCart {
  cartId: string;
  discriminator: 'Cart';
}

export type AuthorizeRule =
  | AuthorizeBySystemRoles
  | AuthorizeBySystemUser
  | AuthorizeByContributor
  | AuthorizeByTeam
  | AuthorizeByCart;

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
  _contributorSystemUserService = new ContributorSystemUserService(this.connection);
  _systemUser: SystemUserExtended | undefined = undefined;
  _keycloakToken: object | undefined = undefined;
  _contributorId: number | undefined = undefined;

  constructor(connection: IDBConnection, init?: { systemUser?: SystemUserExtended; keycloakToken?: object }) {
    super(connection);

    this._systemUser = init?.systemUser;
    this._keycloakToken = init?.keycloakToken;
  }

  get systemUser(): SystemUserExtended | undefined {
    return this._systemUser;
  }

  get contributorId(): number | undefined {
    return this._contributorId;
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
        case 'Contributor':
          authorizeResults.push(await this.authorizeByContributor());
          break;
        case 'Team':
          authorizeResults.push(await this.authorizeByTeam(authorizeRule));
          break;
        case 'Cart':
          authorizeResults.push(await this.authorizeByCart(authorizeRule));
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
   * @returns {Promise<boolean>} Resolves with `true` if the user is a valid system user, otherwise `false`.
   */
  async authorizeBySystemUser(): Promise<boolean> {
    const user = await this.getCachedSystemUser();

    return !!user; // true if user exists, false otherwise
  }

  /**
   * Check whether the user is authorized to access a team-scoped entity.
   *
   * @param {AuthorizeByTeam} authorizeRule
   * @returns {Promise<boolean>}
   */
  async authorizeByTeam(authorizeRule: AuthorizeByTeam): Promise<boolean> {
    if (!authorizeRule) {
      return false;
    }

    const user = await this.getCachedSystemUser();
    if (!user) {
      return false;
    }

    const teamAuthorizationService = new TeamAuthorizationService(this.connection);
    return teamAuthorizationService.isUserAuthorizedForTeamEntity(user.system_user_id, authorizeRule);
  }

  /**
   * Check if the user is authorized to access the cart
   *
   * @param {AuthorizeByCart} authorizeByCart
   * @return {Promise<boolean>}
   */
  async authorizeByCart(authorizeByCart: AuthorizeByCart): Promise<boolean> {
    const { cartId } = authorizeByCart;

    // Fetch the cart based on the cartId
    const cartService = new CartService(this.connection);
    const cart = await cartService.findCartById(cartId);

    // Cart does not exist
    if (!cart) {
      return false;
    }

    // Only active carts are accessible
    if (cart.cart_status !== 'active') {
      return false;
    }

    // Deny access to carts whose validity window has ended
    const recordEndDate = cart.record_end_date ? dayjs(cart.record_end_date) : null;
    const cartValidityEnded = recordEndDate !== null && (!recordEndDate.isValid() || !recordEndDate.isAfter(dayjs()));
    if (cartValidityEnded) {
      return false;
    }

    // Ensure we have the current system user
    const currentUser = await this.getCachedSystemUser();

    // If the cart has a system_user_id (created by an authenticated user), and the current user is authenticated
    if (cart.system_user_id && currentUser) {
      // Check if the authenticated user is the owner of the cart
      return cart.system_user_id === currentUser.system_user_id;
    }

    // If the cart was created by an unauthenticated user (no system_user_id set)
    if (!cart.system_user_id) {
      // Allow access for both authenticated and non-authenticated users (there is no ownership to verify)
      return true;
    }

    return false;
  }

  /**
   * Private helper method to fetch and cache the system user object.
   *
   * @returns {Promise<SystemUser | null>} Resolves with the system user object, or `null` if not found.
   */
  async getCachedSystemUser(): Promise<SystemUser | null> {
    if (this._systemUser) {
      return this._systemUser;
    }

    const user = await this.getSystemUserObject(); // fetch from DB or service
    this._systemUser = user ?? undefined;
    return this._systemUser ?? null;
  }

  /**
   * Check if the user is a known contributor by token client id.
   *
   * Note: This is for submission-source attribution and authorization.
   *
   * @returns {Promise<boolean>}
   */
  async authorizeByContributor(): Promise<boolean> {
    if (!this._keycloakToken) {
      return false;
    }

    const systemUser = await this.getCachedSystemUser();
    if (!systemUser?.system_user_id) {
      return false;
    }

    const contributorSystemUser = await this._contributorSystemUserService.findContributorSystemUser(
      systemUser.system_user_id
    );
    if (!contributorSystemUser) {
      return false;
    }

    this._contributorId = contributorSystemUser.contributor_id;

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
