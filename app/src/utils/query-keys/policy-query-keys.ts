import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Key prefix of every page of the policies list.
 *
 * @returns The policies list key prefix.
 */
const lists = () => [QUERY_KEY_ROOT.POLICY, 'list'] as const;

/**
 * Key of one page of the policies list.
 *
 * @param {ApiSearchParams} search The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The policies list key.
 */
const list = (search: ApiSearchParams, pagination: ApiPaginationRequestOptions) =>
  [...lists(), { search, pagination }] as const;

/**
 * Key prefix of everything cached for one policy.
 *
 * @param {string} policyId The policy.
 * @returns The policy key prefix.
 */
const policy = (policyId: string) => [QUERY_KEY_ROOT.POLICY, policyId] as const;

/**
 * Key of one policy's detail, including its statements and every expression it owns.
 *
 * @param {string} policyId The policy.
 * @returns The policy detail key.
 */
const detail = (policyId: string) => [...policy(policyId), 'detail'] as const;

/**
 * Key prefix of every page of a policy's expressions table.
 *
 * @param {string} policyId The policy.
 * @returns The expressions key prefix.
 */
const expressionsAll = (policyId: string) => [...policy(policyId), 'expressions'] as const;

/**
 * Key of one page of a policy's expressions table.
 *
 * @param {string} policyId The policy.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The expressions key.
 */
const expressions = (policyId: string, pagination: ApiPaginationRequestOptions) =>
  [...expressionsAll(policyId), { pagination }] as const;

/**
 * Key of one page of the teams a policy is granted to.
 *
 * @param {string} policyId The policy.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The policy teams key.
 */
const teams = (policyId: string, pagination: ApiPaginationRequestOptions) =>
  [...policy(policyId), 'teams', { pagination }] as const;

/**
 * Query keys for policies, ordered from broad to narrow so that each prefix names the set of queries a
 * change invalidates.
 */
export const policyQueryKeys = { lists, list, policy, detail, expressionsAll, expressions, teams };
