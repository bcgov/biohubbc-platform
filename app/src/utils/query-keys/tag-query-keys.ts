import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix of every tag query.
 *
 * @returns The tag key prefix.
 */
const all = () => [QUERY_KEY_ROOT.TAG] as const;

/**
 * Key of one tag list.
 *
 * @param {ITagsQueryParams} params The name search, board, page and sort sent.
 * @returns The tag list key.
 */
const list = (params: ITagsQueryParams) => [...all(), 'list', params] as const;

/**
 * Key of one tag's detail.
 *
 * @param {string} tagId The tag.
 * @returns The tag detail key.
 */
const detail = (tagId: string) => [...all(), 'detail', tagId] as const;

/**
 * Key prefix of every query of one tag's rules: its rule list pages and rule details.
 *
 * @param {string} tagId The tag the rules apply.
 * @returns The tag's rule key prefix.
 */
const rules = (tagId: string) => [...all(), 'rule', tagId] as const;

/**
 * Key of one page of a tag's rule list.
 *
 * @param {string} tagId The tag the rules apply.
 * @param {ApiPaginationRequestOptions} params The page and sort sent.
 * @returns The tag rule list key.
 */
const ruleList = (tagId: string, params: ApiPaginationRequestOptions) => [...rules(tagId), 'list', params] as const;

/**
 * Key of one tag rule's detail, with its expression.
 *
 * @param {string} tagId The tag the rule applies.
 * @param {string} tagRuleId The tag rule.
 * @returns The tag rule detail key.
 */
const ruleDetail = (tagId: string, tagRuleId: string) => [...rules(tagId), 'detail', tagRuleId] as const;

/**
 * Query keys for tags, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates. A ticket's tags are keyed under the ticket; see `ticketQueryKeys.tags`.
 */
export const tagQueryKeys = { all, list, detail, rules, ruleList, ruleDetail };
