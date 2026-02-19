import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique team name for auto-created data request teams.
 *
 * @returns {string} A unique team name.
 */
export function _generateDataRequestTeamName(): string {
  return `Data request team - ${uuidv4()}`;
}