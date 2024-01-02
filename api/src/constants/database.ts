/**
 * The identity source of the authenticated user.
 *
 * @export
 * @enum {number}
 */
export enum SYSTEM_IDENTITY_SOURCE {
  /**
   * Human users authenticating via IDIR.
   */
  IDIR = 'IDIR',
  /**
   * Human users authenticating via BCeID Basic.
   */
  BCEID_BASIC = 'BCEIDBASIC',
  /**
   * Human users authenticating via BCeID Business.
   */
  BCEID_BUSINESS = 'BCEIDBUSINESS',
  /**
   * External machine users (ie: keycloak service client users for external platform applications).
   */
  SYSTEM = 'SYSTEM',
  /**
   * Internal machine users (ie: postgres, biohub_api).
   */
  DATABASE = 'DATABASE'
}
