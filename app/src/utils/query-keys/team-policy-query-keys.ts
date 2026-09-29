import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ITeamPolicySearchParams } from 'interfaces/useTeamPoliciesApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix of every page of the team-policy assignments list.
 *
 * @returns The team policies key prefix.
 */
const lists = () => [QUERY_KEY_ROOT.TEAM_POLICY, 'list'] as const;

/**
 * Key of one page of the team-policy assignments list.
 *
 * @param {ITeamPolicySearchParams} search The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The team policies key.
 */
const list = (search: ITeamPolicySearchParams, pagination: ApiPaginationRequestOptions) =>
  [...lists(), { search, pagination }] as const;

/**
 * Query keys for team-policy assignments.
 */
export const teamPolicyQueryKeys = { lists, list };
