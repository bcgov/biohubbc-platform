import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Key prefix of every page of the teams list.
 *
 * @returns The teams list key prefix.
 */
const lists = () => [QUERY_KEY_ROOT.TEAM, 'list'] as const;

/**
 * Key of one page of the teams list.
 *
 * @param {ApiSearchParams} search The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The teams list key.
 */
const list = (search: ApiSearchParams, pagination: ApiPaginationRequestOptions) =>
  [...lists(), { search, pagination }] as const;

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
/**
 * Mutation key shared by every change to a team's membership, so the reloads they need wait for the last of them.
 *
 * @returns The membership changes mutation key.
 */
const membershipChanges = () => [QUERY_KEY_ROOT.TEAM, 'membership-changes'] as const;

export const teamQueryKeys = { lists, list, members, membershipChanges };
