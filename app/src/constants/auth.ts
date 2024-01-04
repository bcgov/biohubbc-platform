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

interface IUserInfo {
  sub: string;
  email_verified: boolean;
  preferred_username: string;
  identity_source: string;
  display_name: string;
  email: string;
}

export interface IIDIRUserInfo extends IUserInfo {
  idir_user_guid: string;
  idir_username: string;
  name: string;
  given_name: string;
  family_name: string;
  identity_provider: 'idir';
}

interface IBCEIDUserInfo {
  bceid_user_guid: string;
  bceid_username: string;
}

export interface IBCEIDBasicUserInfo extends IBCEIDUserInfo, IUserInfo {
  identity_provider: 'bceidbasic';
}

export interface IBCEIDBusinessUserInfo extends IBCEIDUserInfo, IUserInfo {
  bceid_business_guid: string;
  bceid_business_name: string;
  identity_provider: 'bceidbusiness';
}
