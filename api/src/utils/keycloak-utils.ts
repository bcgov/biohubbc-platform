import { SOURCE_SYSTEM, SYSTEM_IDENTITY_SOURCE } from '../constants/database';

/**
 * Parses out the preferred_username name from the token.
 *
 * @param {object} keycloakToken
 * @return {*} {(string | null)}
 */
export const getUserIdentifier = (keycloakToken: object): string | null => {
  const userIdentifier = keycloakToken?.['idir_user_guid']?.toLowerCase();
  console.log('userIdenfier is: ', userIdentifier);

  if (!userIdentifier) {
    return null;
  }

  return userIdentifier;
};

/**
 * Parses out the preferred_username identity source (idir, bceid, etc) from the token and maps it to a known
 * `SYSTEM_IDENTITY_SOURCE`.
 *
 * @param {object} keycloakToken
 * @return {*} {SYSTEM_IDENTITY_SOURCE}
 */
export const getUserIdentitySource = (keycloakToken: object): SYSTEM_IDENTITY_SOURCE => {
  const userIdentitySource = keycloakToken?.['identity_provider']?.toUpperCase();

  console.log('userIdentitySource is:', userIdentitySource);

  const idir_user_guid = keycloakToken?.['idir_user_guid'];

  console.log('idir_user_guid is: ', idir_user_guid);

  if (userIdentitySource === SYSTEM_IDENTITY_SOURCE.BCEID) {
    return SYSTEM_IDENTITY_SOURCE.BCEID;
  }

  if (userIdentitySource === SYSTEM_IDENTITY_SOURCE.IDIR) {
    return SYSTEM_IDENTITY_SOURCE.IDIR;
  }

  if (userIdentitySource === SYSTEM_IDENTITY_SOURCE.DATABASE) {
    return SYSTEM_IDENTITY_SOURCE.DATABASE;
  }

  if (userIdentitySource === SYSTEM_IDENTITY_SOURCE.SYSTEM) {
    return SYSTEM_IDENTITY_SOURCE.SYSTEM;
  }

  console.log('************* we do not have a proper identity source');

  // Covers users created directly in keycloak, that wouldn't have identity source
  return SYSTEM_IDENTITY_SOURCE.DATABASE;
};

/**
 * Parses out the `clientId` and `azp` fields from the token and maps them to a known `SOURCE_SYSTEM`, or null if no
 * match is found.
 *
 * @param {object} keycloakToken
 * @return {*}  {(SOURCE_SYSTEM | null)}
 */
export const getKeycloakSource = (keycloakToken: object): SOURCE_SYSTEM | null => {
  const clientId = keycloakToken?.['clientId']?.toUpperCase();
  const azp = keycloakToken?.['azp']?.toUpperCase();

  if (!clientId && !azp) {
    return null;
  }

  if ([clientId, azp].includes(SOURCE_SYSTEM['SIMS-SVC'])) {
    return SOURCE_SYSTEM['SIMS-SVC'];
  }

  return null;
};
