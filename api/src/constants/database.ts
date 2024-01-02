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

/**
 * The source system of a DwCA data set submission.
 *
 * Typically an external system that is participating in BioHub by submitting data to the BioHub Platform Backbone.
 *
 * Sources are based on the client id of the keycloak service account the participating system uses to authenticate with
 * the BioHub Platform Backbone.
 *
 * @export
 * @enum {number}
 */
export enum SOURCE_SYSTEM {
  'SIMS-SVC-4464' = 'SIMS-SVC-4464'
}
