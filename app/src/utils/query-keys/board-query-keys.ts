import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { IBoardsQueryParams } from 'interfaces/useBoardsApi.interface';

/**
 * Key prefix of every board query.
 *
 * @returns The board key prefix.
 */
const all = () => [QUERY_KEY_ROOT.BOARD] as const;

/**
 * Key of one page of the board list.
 *
 * @param {IBoardsQueryParams} params The name search, page and sort sent.
 * @returns The board list key.
 */
const list = (params: IBoardsQueryParams) => [...all(), 'list', params] as const;

/**
 * Key of one board's detail: the board and its tags.
 *
 * @param {string} boardId The board.
 * @returns The board detail key.
 */
const detail = (boardId: string) => [...all(), 'detail', boardId] as const;

/**
 * Query keys for boards, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const boardQueryKeys = { all, list, detail };
