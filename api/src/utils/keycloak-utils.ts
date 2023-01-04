import { SOURCE_SYSTEM, SYSTEM_IDENTITY_SOURCE } from '../constants/database';

/**
 * Parses out the user's GUID from a keycloak token, which is extracted from the
 * `preferred_username` property.
 *
 * @example getUserGuid({ preferred_username: 'aaabbaaa@idir' }) // => 'aaabbaaa'
 *
 * @param {object} keycloakToken
 * @return {*} {(string | null)}
 */
export const getUserGuid = (keycloakToken: object): string | null => {
  console.log('keycloakToken in getUserGuid: ', keycloakToken);
  const userIdentifier = keycloakToken?.['preferred_username']?.split('@')?.[0];

  console.log('userIdentifier in getUserGuid *******************: ', userIdentifier);

  if (!userIdentifier) {
    return null;
  }

  console.log('here');

  return userIdentifier;
};

/**
 * Parses out the preferred_username identity source ('idir', 'bceidbasic', etc.) from the token and maps it to a known
 * `SYSTEM_IDENTITY_SOURCE`.
 *
 * @example getUserIdentitySource({ ...token, identity_provider: 'idir' }) => SYSTEM_IDENTITY_SOURCE.IDIR
 *
 * @param {object} keycloakToken
 * @return {*} {SYSTEM_IDENTITY_SOURCE}
 */
export const getUserIdentitySource = (keycloakToken: object): SYSTEM_IDENTITY_SOURCE => {
  const userIdentitySource: string = keycloakToken?.['identity_provider']?.toUpperCase();

  console.log('inside getUserIdentitySource: userIdentitySource: ', userIdentitySource);

  // Coerce the raw keycloak token identity provider value into an system identity source enum value
  switch (userIdentitySource) {
    case SYSTEM_IDENTITY_SOURCE.BCEID_BASIC:
      return SYSTEM_IDENTITY_SOURCE.BCEID_BASIC;

    case SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS:
      return SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS;

    case SYSTEM_IDENTITY_SOURCE.IDIR:
      return SYSTEM_IDENTITY_SOURCE.IDIR;

    case SYSTEM_IDENTITY_SOURCE.SYSTEM:
      return SYSTEM_IDENTITY_SOURCE.SYSTEM;

    case SYSTEM_IDENTITY_SOURCE.DATABASE:
      return SYSTEM_IDENTITY_SOURCE.DATABASE;

    default:
      // Covers a user created directly in keycloak which wouldn't have an identity source
      return SYSTEM_IDENTITY_SOURCE.DATABASE;
  }
};

/**
 * Parses out the user's identifier from a keycloak token.
 *
 * @example getUserIdentifier({ ....token, bceid_username: 'jsmith@idir' }) => 'jsmith'
 *
 * @param {object} keycloakToken
 * @return {*} {(string | null)}
 */
export const getUserIdentifier = (keycloakToken: object): string | null => {
  const userIdentifier = keycloakToken?.['idir_username'] || keycloakToken?.['bceid_username'];

  if (!userIdentifier) {
    return null;
  }

  return userIdentifier;
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

  console.log('clientId is: ', clientId);
  const azp = keycloakToken?.['azp']?.toUpperCase();
  console.log('azp is: ', azp);

  if (!clientId && !azp) {
    return null;
  }

  if ([clientId, azp].includes(SOURCE_SYSTEM['SIMS-SVC-4464'])) {
    console.log('should return source system');
    return SOURCE_SYSTEM['SIMS-SVC-4464'];
  }

  return null;
};
