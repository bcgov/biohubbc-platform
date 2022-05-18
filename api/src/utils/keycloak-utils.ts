import { SOURCE, SYSTEM_IDENTITY_SOURCE } from '../constants/database';

const raw_bceid_identity_sources = ['BCEID-BASIC-AND-BUSINESS', 'BCEID'];
const raw_idir_identity_sources = ['IDIR'];

/**
 * Parses out the preferred_username name from the token.
 *
 * @param {object} keycloakToken
 * @return {*} {(string | null)}
 */
export const getUserIdentifier = (keycloakToken: object): string | null => {
  const userIdentifier = keycloakToken?.['preferred_username']?.split('@')?.[0];

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
  const userIdentitySource = keycloakToken?.['preferred_username']?.split('@')?.[1]?.toUpperCase();

  if (raw_bceid_identity_sources.includes(userIdentitySource)) {
    return SYSTEM_IDENTITY_SOURCE.BCEID;
  }

  if (raw_idir_identity_sources.includes(userIdentitySource)) {
    return SYSTEM_IDENTITY_SOURCE.IDIR;
  }

  if (userIdentitySource === SYSTEM_IDENTITY_SOURCE.DATABASE) {
    return SYSTEM_IDENTITY_SOURCE.DATABASE;
  }

  // Covers users created directly in keycloak, that wouldn't have identity source
  return SYSTEM_IDENTITY_SOURCE.DATABASE;
};

/**
 * Parses out the clientId and azp strings from the token and maps them to a known `SOURCE`
 *
 * @param {object} keycloakToken
 * @return {*}  {(SOURCE | null)}
 */
export const getKeycloakSource = (keycloakToken: object): SOURCE | null => {
  const clientId = keycloakToken?.['clientId']?.toUpperCase();
  const azp = keycloakToken?.['azp']?.toUpperCase();

  if (!clientId && !azp) {
    return null;
  }

  if (clientId === 'SIMS-SVP' || azp === 'SIMS-SVP') {
    return SOURCE['SIMS-SVC'];
  }

  return null;
};
