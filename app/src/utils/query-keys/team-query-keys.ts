import { QUERY_KEY_ROOT } from 'constants/query-keys';

/**
 * Key of one team's members.
 *
 * @param {string} teamId The team.
 * @returns The team members key.
 */
const members = (teamId: string) => [QUERY_KEY_ROOT.TEAM, teamId, 'members'] as const;

/**
 * Query keys for teams.
 */
export const teamQueryKeys = { members };
