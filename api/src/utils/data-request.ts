import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique team name for auto-created data request teams.
 *
 * @returns {string} A unique team name.
 */
export function _generateDataRequestTeamName(): string {
  return `Data request team - ${uuidv4()}`;
}

/**
 * Generates a unique policy name for auto-created data request policies.
 *
 * @returns {string} A unique policy name.
 */
export function _generateDataRequestPolicyName(): string {
  return `Data request policy - ${uuidv4()}`;
}
