import { useKeycloak } from '@react-keycloak/web';
import { KeycloakInstance } from 'keycloak-js';
import { useCallback } from 'react';
import { useApi } from './useApi';
import useDataLoader from './useDataLoader';

export enum SYSTEM_IDENTITY_SOURCE {
  BCEID = 'BCEID',
  IDIR = 'IDIR'
}

const raw_bceid_identity_sources = ['BCEID-BASIC-AND-BUSINESS', 'BCEID'];
const raw_idir_identity_sources = ['IDIR'];

/**
 * IUserInfo interface, represents the userinfo provided by keycloak.
 *
 * @export
 * @interface IUserInfo
 */
export interface IUserInfo {
  name?: string;
  preferred_username?: string;
  given_name?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Interface defining the objects and helper functions returned by `useKeycloakWrapper`
 *
 * @export
 * @interface IKeycloakWrapper
 */
export interface IKeycloakWrapper {
  /**
   * Original raw keycloak object.
   *
   * @type {(KeycloakInstance | undefined)}
   * @memberof IKeycloakWrapper
   */
  keycloak: KeycloakInstance | undefined;
  /**
   * Returns `true` if the user's information has been loaded, false otherwise.
   *
   * @type {boolean}
   * @memberof IKeycloakWrapper
   */
  hasLoadedAllUserInfo: boolean;
  /**
   * The user's system roles, if any.
   *
   * @type {string[]}
   * @memberof IKeycloakWrapper
   */
  systemRoles: string[];
  /**
   * Returns `true` if the user's `systemRoles` contain at least 1 of the specified `validSystemRoles`, `false` otherwise.
   *
   * @memberof IKeycloakWrapper
   */
  hasSystemRole: (validSystemRoles?: string[]) => boolean;
  /**
   * True if the user has at least 1 pending access request.
   *
   * @type {boolean}
   * @memberof IKeycloakWrapper
   */
  hasAccessRequest: boolean;
  /**
   * Get out the username portion of the preferred_username from the token.
   *
   * @memberof IKeycloakWrapper
   */
  getUserIdentifier: () => string | null;
  /**
   * Get the identity source portion of the preferred_username from the token.
   *
   * @memberof IKeycloakWrapper
   */
  getIdentitySource: () => string | null;
  username: string | undefined;
  displayName: string | undefined;
  email: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  systemUserId: number;
  /**
   * Force this keycloak wrapper to refresh its data.
   *
   * Note: currently this only refreshes the `hasAccessRequest` property.
   *
   * @memberof IKeycloakWrapper
   */
  refresh: () => void;
}

/**
 * Wraps the raw keycloak object, returning an object that contains the original raw keycloak object plus useful helper
 * functions.
 *
 * @return {*}  {IKeycloakWrapper}
 */
function useKeycloakWrapper(): IKeycloakWrapper {
  const { keycloak } = useKeycloak();

  const biohubApi = useApi();

  const keycloakUserDataLoader = useDataLoader(async () => {
    return (keycloak && (keycloak.loadUserInfo() as IUserInfo)) || undefined;
  });

  const userDataLoader = useDataLoader(() => biohubApi.user.getUser());

  const hasPendingAdministrativeActivitiesDataLoader = useDataLoader(() =>
    biohubApi.admin.hasPendingAdministrativeActivities()
  );

  if (keycloak) {
    // keycloak is ready, load keycloak user info
    keycloakUserDataLoader.load();
  }

  if (keycloak?.authenticated) {
    // keycloak user is authenticated, load system user info
    userDataLoader.load();

    if (userDataLoader.data && (!userDataLoader.data.role_names.length || userDataLoader.data?.user_record_end_date)) {
      // Authenticated user either has has no roles or has been deactivated
      // Check if the user has a pending access request
      hasPendingAdministrativeActivitiesDataLoader.load();
    }
  }

  /**
   * Parses out the username portion of the preferred_username from the token.
   *
   * @param {object} keycloakToken
   * @return {*} {(string | null)}
   */
  const getUserIdentifier = useCallback((): string | null => {
    const userIdentifier = keycloakUserDataLoader.data?.['preferred_username']?.split('@')?.[0];

    if (!userIdentifier) {
      return null;
    }

    return userIdentifier;
  }, [keycloakUserDataLoader.data]);

  /**
   * Parses out the identity source portion of the preferred_username from the token.
   *
   * @param {object} keycloakToken
   * @return {*} {(string | null)}
   */
  const getIdentitySource = useCallback((): SYSTEM_IDENTITY_SOURCE | null => {
    const identitySource = keycloakUserDataLoader.data?.['preferred_username']?.split('@')?.[1].toUpperCase();

    if (!identitySource) {
      return null;
    }

    if (raw_bceid_identity_sources.includes(identitySource)) {
      return SYSTEM_IDENTITY_SOURCE.BCEID;
    }

    if (raw_idir_identity_sources.includes(identitySource)) {
      return SYSTEM_IDENTITY_SOURCE.IDIR;
    }

    return null;
  }, [keycloakUserDataLoader.data]);

  const systemUserId = (): number => {
    return userDataLoader.data?.id || 0;
  };

  const getSystemRoles = (): string[] => {
    return userDataLoader.data?.role_names || [];
  };

  const hasSystemRole = (validSystemRoles?: string[]) => {
    if (!validSystemRoles || !validSystemRoles.length) {
      return true;
    }

    const userSystemRoles = getSystemRoles();

    if (userSystemRoles.some((item) => validSystemRoles.includes(item))) {
      return true;
    }

    return false;
  };

  const username = (): string | undefined => {
    return keycloakUserDataLoader.data?.preferred_username;
  };

  const displayName = (): string | undefined => {
    return keycloakUserDataLoader.data?.name || keycloakUserDataLoader.data?.preferred_username;
  };

  const email = (): string | undefined => {
    return keycloakUserDataLoader.data?.email;
  };

  const firstName = (): string | undefined => {
    return keycloakUserDataLoader.data?.firstName;
  };

  const lastName = (): string | undefined => {
    return keycloakUserDataLoader.data?.lastName;
  };

  const refresh = () => {
    userDataLoader.refresh();
    hasPendingAdministrativeActivitiesDataLoader.refresh();
  };

  return {
    keycloak: keycloak,
    hasLoadedAllUserInfo: !!(userDataLoader.data || hasPendingAdministrativeActivitiesDataLoader.data),
    systemRoles: getSystemRoles(),
    hasSystemRole,
    hasAccessRequest: !!hasPendingAdministrativeActivitiesDataLoader.data,
    getUserIdentifier,
    getIdentitySource,
    username: username(),
    email: email(),
    displayName: displayName(),
    firstName: firstName(),
    lastName: lastName(),
    systemUserId: systemUserId(),
    refresh
  };
}

export default useKeycloakWrapper;
