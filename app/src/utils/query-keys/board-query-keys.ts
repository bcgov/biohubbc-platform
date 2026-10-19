import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { IBoardTicketsQueryParams } from 'interfaces/useBoardsApi.interface';

/**
 * Key prefix of every board query.
 *
 * @returns The board key prefix.
 */
const all = () => [QUERY_KEY_ROOT.BOARD] as const;

/**
 * Key of the board list.
 *
 * @returns The board list key.
 */
const list = () => [...all(), 'list'] as const;

/**
 * Key of one board's detail: its tags and every swimlane.
 *
 * @param {string} boardId The board.
 * @returns The board detail key.
 */
const detail = (boardId: string) => [...all(), 'detail', boardId] as const;

/**
 * Key prefix of every board's tickets.
 *
 * @returns The board tickets key prefix.
 */
const ticketsAll = () => [...all(), 'tickets'] as const;

/**
 * Key prefix of one board's tickets, with or without closed tickets.
 *
 * @param {string} boardId The board.
 * @returns The board's tickets key prefix.
 */
const ticketsForBoard = (boardId: string) => [...ticketsAll(), boardId] as const;

/**
 * Key of one board's tickets grouped by swimlane.
 *
 * @param {string} boardId The board.
 * @param {IBoardTicketsQueryParams} params Whether closed tickets are included.
 * @returns The board tickets key.
 */
const tickets = (boardId: string, params: IBoardTicketsQueryParams) => [...ticketsForBoard(boardId), params] as const;

/**
 * Query keys for boards, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const boardQueryKeys = { all, list, detail, ticketsAll, ticketsForBoard, tickets };
