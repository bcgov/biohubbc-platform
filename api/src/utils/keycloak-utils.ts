import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import { getDBConstants } from '../database/db-constants';
import { SystemUser } from '../repositories/user-repository';

export interface KeycloakUserInformation {
  preferred_username?: string | null;
  identity_provider?: string | null;
  idir_username?: string | null;
  bceid_username?: string | null;
  sub?: string | null;
  display_name?: string | null;
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  bceid_business_name?: string | null;
  [key: string]: unknown;
}

/**
 * Parses out the user's GUID from a keycloak token, which is extracted from the
 * `preferred_username` property.
 *
 * @example getUserGuid({ preferred_username: '123-456-789@idir' }) // => '123-456-789'
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*} {(string | null)}
 */
export const getUserGuid = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  const userIdentifier = keycloakToken?.['preferred_username']?.split('@')?.[0];

  if (!userIdentifier) {
    return null;
  }

  return userIdentifier;
};

/**
 * Parses out the preferred_username identity source ('idir', 'bceidbasic', etc.) from the token and maps it to a known
 * `SYSTEM_IDENTITY_SOURCE`. If the `identity_provider` field in the keycloak token object is undefined, then the
 * identity source is inferred from the `preferred_username` field as a contingency.
 *
 * @example getUserIdentitySource({ ...token, identity_provider: 'bceidbasic' }) => SYSTEM_IDENTITY_SOURCE.BCEID_BASIC
 * @example getUserIdentitySource({ preferred_username: '123-456-789@idir' }) => SYSTEM_IDENTITY_SOURCE.IDIR
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*} {SYSTEM_IDENTITY_SOURCE}
 */
export const getUserIdentitySource = (keycloakToken: KeycloakUserInformation | null | undefined): SYSTEM_IDENTITY_SOURCE => {
  const userIdentitySource: string | undefined =
    keycloakToken?.['identity_provider'] || keycloakToken?.['preferred_username']?.split('@')?.[1];

  return coerceUserIdentitySource(userIdentitySource ?? null);
};

/**
 * Coerce the raw keycloak token identity provider value into an system identity source enum value.
 * If the given user identity source string does not satisfy one of `SYSTEM_IDENTITY_SOURCE`, the return
 * value defaults to `SYSTEM_IDENTITY_SOURCE.DATABASE`.
 *
 * @example coerceUserIdentitySource('idir') => 'idir' satisfies SYSTEM_IDENTITY_SOURCE.IDIR
 *
 * @param userIdentitySource the identity source string
 * @returns {*} {SYSTEM_IDENTITY_SOURCE} the identity source belonging to type SYSTEM_IDENTITY_SOURCE
 */
export const coerceUserIdentitySource = (userIdentitySource: string | null): SYSTEM_IDENTITY_SOURCE => {
  switch (userIdentitySource?.toUpperCase()) {
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
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*} {(string | null)}
 */
export const getUserIdentifier = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  const userIdentifier = keycloakToken?.['idir_username'] || keycloakToken?.['bceid_username'];

  if (!userIdentifier) {
    return null;
  }

  return userIdentifier;
};

/**
 * Parses out the `sub` field from the token and maps them to a known service client system user.
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*}  {(SystemUser | null)}
 */
export const getServiceClientSystemUser = (keycloakToken: KeycloakUserInformation | null | undefined): SystemUser | null => {
  const sub = keycloakToken?.['sub'];

  if (!sub) {
    return null;
  }

  // Find and return a matching known service client, if one exists
  return getDBConstants().serviceClientUsers.find((item) => item.user_guid === sub) || null;
};

/**
 * Parses out the user's display name from a keycloak token.
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*}  {(string | null)}
 */
export const getDisplayName = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  return keycloakToken?.['display_name'] ?? null;
};

/**
 * Parses out the user's email from a keycloak token.
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*}  {(string | null)}
 */
export const getEmail = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  return keycloakToken?.['email'] ?? null;
};

/**
 * Parses out the user's given name (first name) from a keycloak token.
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*}  {(string | null)}
 */
export const getGivenName = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  return keycloakToken?.['given_name'] ?? null;
};

/**
 * Parses out the user's family name (last name) from a keycloak token.
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*}  {(string | null)}
 */
export const getFamilyName = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  return keycloakToken?.['family_name'] ?? null;
};

/**
 * Parses out the user's agency from a keycloak token.
 * This is only available for BCeID Business users via the `bceid_business_name` field.
 *
 * @param {KeycloakUserInformation} keycloakToken
 * @return {*}  {(string | null)}
 */
export const getAgency = (keycloakToken: KeycloakUserInformation | null | undefined): string | null => {
  return keycloakToken?.['bceid_business_name'] ?? null;
};
