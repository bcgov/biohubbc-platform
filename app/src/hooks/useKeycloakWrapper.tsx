import { useKeycloak } from '@react-keycloak/web';
import { IGetUserResponse } from 'interfaces/useUserApi.interface';
import { KeycloakInstance } from 'keycloak-js';
import { useCallback, useEffect, useState } from 'react';
import { useBiohubApi } from './useBioHubApi';

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

  const biohubApi = useBiohubApi();

  const [systemUser, setSystemUser] = useState<IGetUserResponse>();
  const [shouldLoadSystemUser, setShouldLoadSystemUser] = useState<boolean>(false);
  const [isSystemUserLoading, setIsSystemUserLoading] = useState<boolean>(false);
  const [hasLoadedSystemUser, setHasLoadedSystemUser] = useState<boolean>(false);

  const [keycloakUser, setKeycloakUser] = useState<IUserInfo | null>(null);
  const [isKeycloakUserLoading, setIsKeycloakUserLoading] = useState<boolean>(false);

  const [shouldLoadAccessRequest, setShouldLoadAccessRequest] = useState<boolean>(false);
  const [hasAccessRequest, setHasAccessRequest] = useState<boolean>(false);

  /**
   * Parses out the username portion of the preferred_username from the token.
   *
   * @param {object} keycloakToken
   * @return {*} {(string | null)}
   */
  const getUserIdentifier = useCallback((): string | null => {
    const userIdentifier = keycloakUser?.['preferred_username']?.split('@')?.[0];

    if (!userIdentifier) {
      return null;
    }

    return userIdentifier;
  }, [keycloakUser]);

  /**
   * Parses out the identity source portion of the preferred_username from the token.
   *
   * @param {object} keycloakToken
   * @return {*} {(string | null)}
   */
  const getIdentitySource = useCallback((): SYSTEM_IDENTITY_SOURCE | null => {
    const identitySource = keycloakUser?.['preferred_username']?.split('@')?.[1].toUpperCase();

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
  }, [keycloakUser]);

  useEffect(() => {
    const getrestorationTrackerUser = async () => {
      let userDetails: IGetUserResponse;

      try {
        userDetails = await biohubApi.user.getUser();
      } catch {
        //do nothing
      }

      setSystemUser(() => {
        if (userDetails?.role_names?.length && !userDetails?.user_record_end_date) {
          setHasLoadedSystemUser(true);
        } else {
          setShouldLoadAccessRequest(true);
        }

        return userDetails;
      });
    };

    if (!keycloak?.authenticated) {
      return;
    }

    if (isSystemUserLoading || (systemUser && !shouldLoadSystemUser)) {
      return;
    }

    setIsSystemUserLoading(true);

    getrestorationTrackerUser();
  }, [keycloak, systemUser, isSystemUserLoading, shouldLoadSystemUser, biohubApi.user]);

  useEffect(() => {
    const getSystemAccessRequest = async () => {
      let accessRequests: number;

      try {
        accessRequests = await biohubApi.admin.hasPendingAdministrativeActivities();
      } catch {
        // do nothing
      }
      setHasAccessRequest(() => {
        setHasLoadedSystemUser(true);
        return accessRequests > 0;
      });
    };

    if (!keycloak?.authenticated) {
      return;
    }

    if (!keycloakUser || !shouldLoadAccessRequest) {
      return;
    }

    getSystemAccessRequest();
  }, [keycloak, biohubApi.admin, getUserIdentifier, hasAccessRequest, keycloakUser, shouldLoadAccessRequest]);

  useEffect(() => {
    const getKeycloakUser = async () => {
      const user = (await keycloak?.loadUserInfo()) as IUserInfo;
      setKeycloakUser(user);
    };

    if (!keycloak?.authenticated) {
      return;
    }

    if (keycloakUser || isKeycloakUserLoading || !keycloak?.authenticated) {
      return;
    }

    setIsKeycloakUserLoading(true);

    getKeycloakUser();
  }, [keycloak, keycloakUser, isKeycloakUserLoading]);

  const systemUserId = (): number => {
    return systemUser?.id || 0;
  };

  const getSystemRoles = (): string[] => {
    return systemUser?.role_names || [];
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
    return keycloakUser?.preferred_username;
  };

  const displayName = (): string | undefined => {
    return keycloakUser?.name || keycloakUser?.preferred_username;
  };

  const email = (): string | undefined => {
    return keycloakUser?.email;
  };

  const firstName = (): string | undefined => {
    return keycloakUser?.firstName;
  };

  const lastName = (): string | undefined => {
    return keycloakUser?.lastName;
  };

  const refresh = () => {
    // refresh system user
    setHasLoadedSystemUser(false);
    setIsSystemUserLoading(false);
    setShouldLoadSystemUser(true);

    // refresh access requests
    setShouldLoadAccessRequest(true);
  };

  return {
    keycloak: keycloak,
    hasLoadedAllUserInfo: hasLoadedSystemUser,
    systemRoles: getSystemRoles(),
    hasSystemRole,
    hasAccessRequest,
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
