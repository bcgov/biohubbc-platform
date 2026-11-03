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
 * Key of one page of the administrative data requests list. A data request's decision is its policy's status, so the
 * key sits under the policies lists and is refreshed with them.
 *
 * @param {ApiSearchParams} search The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The data requests list key.
 */
const dataRequests = (search: ApiSearchParams, pagination: ApiPaginationRequestOptions) =>
  [...lists(), 'data-requests', { search, pagination }] as const;

/**
 * Key of one data request as the administrative pages show it. It sits under the policies lists for the same reason
 * as the data requests list.
 *
 * @param {string} dataRequestId The data request.
 * @returns The data request key.
 */
const dataRequest = (dataRequestId: string) => [...lists(), 'data-requests', dataRequestId] as const;

/**
 * Key of the feature types a data request asks for. They come from the statements and expressions of its policy, so
 * the key sits under the data request's own key and is refreshed with the policies lists.
 *
 * @param {string} dataRequestId The data request.
 * @returns The data request feature types key.
 */
const dataRequestFeatureTypes = (dataRequestId: string) => [...dataRequest(dataRequestId), 'feature-types'] as const;

/**
 * Key of the recipients of a data request: the members of the team its policy is assigned to. It sits under the data
 * request's own key and is refreshed with the policies lists.
 *
 * @param {string} dataRequestId The data request.
 * @returns The data request recipients key.
 */
const dataRequestRecipients = (dataRequestId: string) => [...dataRequest(dataRequestId), 'recipients'] as const;

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
export const policyQueryKeys = {
  lists,
  list,
  dataRequests,
  dataRequest,
  dataRequestFeatureTypes,
  dataRequestRecipients,
  policy,
  detail,
  expressionsAll,
  expressions,
  teams
};
