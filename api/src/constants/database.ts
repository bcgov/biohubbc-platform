/**
 * The identity source of the authenticated user.
 *
 * @export
 * @enum {number}
 */
export enum SYSTEM_IDENTITY_SOURCE {
  IDIR = 'IDIR',
  BCEID_BASIC = 'BCEIDBASIC',
  BCEID_BUSINESS = 'BCEIDBUSINESS',
  // System users (ie: keycloak service client users)
  SYSTEM = 'SYSTEM',
  // Internal database users (ie: postgres, biohub_api)
  DATABASE = 'DATABASE'
}
