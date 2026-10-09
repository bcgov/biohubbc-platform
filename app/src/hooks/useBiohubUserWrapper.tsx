import { useQuery } from '@tanstack/react-query';
import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { useApi } from 'hooks/useApi';
import { useAuth } from 'react-oidc-context';
import { coerceIdentitySource } from 'utils/authUtils';
import { userQueryKeys } from 'utils/query-keys/user-query-keys';

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

/**
 * The signed-in user's BioHub record, loaded once per session, with fallbacks from the token profile.
 *
 * The record comes from `getOrRegisterUser`, which registers a first-time user, so it is keyed on the token subject
 * and never refetched within a session. It is a write, so the request is not cancelled once started.
 *
 * @returns {IBiohubUserWrapper} The user's identity and roles; `isLoading` stays true until the record has been
 * requested and has settled, including while the viewer is signed out.
 */
function useBiohubUserWrapper(): IBiohubUserWrapper {
  const auth = useAuth();

  const biohubApi = useApi();

  const biohubUserQuery = useQuery({
    queryKey: userQueryKeys.self(auth.user?.profile?.sub ?? ''),
    queryFn: () => biohubApi.user.getOrRegisterUser(),
    enabled: auth.isAuthenticated,
    staleTime: Infinity
  });

  const biohubUser = biohubUserQuery.data;

  const isLoading = !biohubUserQuery.isFetched;

  const systemUserId = biohubUser?.system_user_id;

  const userGuid =
    biohubUser?.user_guid ||
    (auth.user?.profile?.idir_user_guid as string)?.toLowerCase() ||
    (auth.user?.profile?.bceid_user_guid as string)?.toLowerCase();

  const userIdentifier =
    biohubUser?.user_identifier ||
    (auth.user?.profile?.idir_username as string) ||
    (auth.user?.profile?.bceid_username as string);

  const roleNames = biohubUser?.role_names;

  const identitySource = coerceIdentitySource(
    biohubUser?.identity_source || (auth.user?.profile?.identity_provider as string)?.toUpperCase()
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
