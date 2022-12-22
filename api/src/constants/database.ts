/**
 * The identity source of the authenticated user.
 *
 * @export
 * @enum {number}
 */
export enum SYSTEM_IDENTITY_SOURCE {
  DATABASE = 'DATABASE',
  IDIR = 'IDIR',
  BCEID_BASIC = 'BCEIDBASIC',
  BCEID_BUSINESS = 'BCEIDBUSINESS',
  SYSTEM = 'SYSTEM'
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
  'SIMS-SVC' = 'SIMS-SVC'
}
