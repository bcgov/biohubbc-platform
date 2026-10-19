import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ITagsQueryParams } from 'interfaces/useTagsApi.interface';

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
 * Key prefix of every tag rule query. Rules sit under the tag prefix because they show their tag's name and color.
 *
 * @returns The tag rule key prefix.
 */
const rules = () => [...all(), 'rule'] as const;

/**
 * Key of the tag rule list.
 *
 * @returns The tag rule list key.
 */
const ruleList = () => [...rules(), 'list'] as const;

/**
 * Key of one tag rule's detail, with its expression.
 *
 * @param {string} tagRuleId The tag rule.
 * @returns The tag rule detail key.
 */
const ruleDetail = (tagRuleId: string) => [...rules(), 'detail', tagRuleId] as const;

/**
 * Query keys for tags, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates. A ticket's tags are keyed under the ticket; see `ticketQueryKeys.tags`.
 */
export const tagQueryKeys = { all, list, rules, ruleList, ruleDetail };
