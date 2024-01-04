import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useAuth } from 'react-oidc-context';
import { coerceIdentitySource } from 'utils/authUtils';

export interface IBiohubUserWrapper {
  /**
   * Set to `true` if the user's information is still loading, false otherwise.
   */
  isLoading: boolean;
  /**
   * The user's system user id.
   */
  systemUserId: number | undefined;
  /**
   * The user's keycloak guid.
   */
  userGuid: string | null | undefined;
  /**
   * The user's identifier (username).
   */
  userIdentifier: string | undefined;
  /**
   * The user's system roles (by name).
   */
  roleNames: string[] | undefined;
  /**
   * The logged in user's identity source (IDIR, BCEID BASIC, BCEID BUSINESS, etc).
   */
  identitySource: SYSTEM_IDENTITY_SOURCE | null;
}

function useBiohubUserWrapper(): IBiohubUserWrapper {
  const auth = useAuth();

  const biohubApi = useApi();

  const biohubUserDataLoader = useDataLoader(() => biohubApi.user.getUser());

  if (auth.isAuthenticated) {
    biohubUserDataLoader.load();
  }

  const isLoading = !biohubUserDataLoader.isReady;

  const systemUserId = biohubUserDataLoader.data?.system_user_id;

  const userGuid =
    biohubUserDataLoader.data?.user_guid ||
    (auth.user?.profile?.idir_user_guid as string)?.toLowerCase() ||
    (auth.user?.profile?.bceid_user_guid as string)?.toLowerCase();

  const userIdentifier =
    biohubUserDataLoader.data?.user_identifier ||
    (auth.user?.profile?.idir_username as string) ||
    (auth.user?.profile?.bceid_username as string);

  const roleNames = biohubUserDataLoader.data?.role_names;

  const identitySource = coerceIdentitySource(
    biohubUserDataLoader.data?.identity_source || (auth.user?.profile?.identity_provider as string)?.toUpperCase()
  );

  return {
    isLoading,
    systemUserId,
    userGuid,
    userIdentifier,
    roleNames,
    identitySource
  };
}

export default useBiohubUserWrapper;
