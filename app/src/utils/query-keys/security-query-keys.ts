import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ISecurityRulesSearchParams } from 'interfaces/useSecurityApi.interface';
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
 * Key of one security category.
 *
 * @param {number} securityCategoryId The category.
 * @returns The category key.
 */
const category = (securityCategoryId: number) => [QUERY_KEY_ROOT.SECURITY, 'category', securityCategoryId] as const;

/**
 * Key prefix of every page of the security rules list.
 *
 * @returns The rules key prefix.
 */
const rulesAll = () => [QUERY_KEY_ROOT.SECURITY, 'rules'] as const;

/**
 * Key of one page of the security rules list.
 *
 * @param {ISecurityRulesSearchParams} search The search and security category sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The rules key.
 */
const rules = (search: ISecurityRulesSearchParams, pagination: ApiPaginationRequestOptions) =>
  [...rulesAll(), { search, pagination }] as const;

/**
 * Query keys for security categories and rules.
 */
export const securityQueryKeys = { categoriesAll, categories, category, rulesAll, rules };
