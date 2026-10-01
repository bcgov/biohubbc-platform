import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Key prefix of every page of the security categories list.
 *
 * @returns The categories key prefix.
 */
const categoriesAll = () => [QUERY_KEY_ROOT.SECURITY, 'categories'] as const;

/**
 * Key of one page of the security categories list.
 *
 * @param {ApiSearchParams} search The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The categories key.
 */
const categories = (search: ApiSearchParams, pagination: ApiPaginationRequestOptions) =>
  [...categoriesAll(), { search, pagination }] as const;

/**
 * Key prefix of every page of the security reasons list.
 *
 * @returns The reasons key prefix.
 */
const reasonsAll = () => [QUERY_KEY_ROOT.SECURITY, 'reasons'] as const;

/**
 * Key of one page of the security reasons list.
 *
 * @param {ApiSearchParams} search The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The reasons key.
 */
const reasons = (search: ApiSearchParams, pagination: ApiPaginationRequestOptions) =>
  [...reasonsAll(), { search, pagination }] as const;

/**
 * Query keys for security categories and reasons.
 */
export const securityQueryKeys = { categoriesAll, categories, reasonsAll, reasons };
