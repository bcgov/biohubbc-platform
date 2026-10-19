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
 * Query keys for tags, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates. A ticket's tags are keyed under the ticket; see `ticketQueryKeys.tags`.
 */
export const tagQueryKeys = { all, list };
