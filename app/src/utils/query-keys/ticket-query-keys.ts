import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { IGetTicketArtifactsQueryParams, ITicketsQueryParams } from 'interfaces/useTicketsApi.interface';

/** Which endpoints a ticket is read through: the administrative ones, or the requesting user's own. */
export type TicketAccessScope = 'admin' | 'user';

/**
 * Key prefix of every ticket query read through one access scope.
 *
 * @param {TicketAccessScope} scope The endpoints the tickets are read through.
 * @returns The ticket key prefix.
 */
const all = (scope: TicketAccessScope) => [QUERY_KEY_ROOT.TICKET, scope] as const;

/**
 * Key prefix of every page of the ticket list.
 *
 * @param {TicketAccessScope} scope The endpoints the tickets are read through.
 * @returns The ticket list key prefix.
 */
const lists = (scope: TicketAccessScope) => [...all(scope), 'list'] as const;

/**
 * Key of one page of the ticket list.
 *
 * @param {TicketAccessScope} scope The endpoints the tickets are read through.
 * @param {ITicketsQueryParams} params The search, filters and page sent.
 * @returns The ticket list key.
 */
const list = (scope: TicketAccessScope, params: ITicketsQueryParams) => [...lists(scope), params] as const;

/**
 * Key of one ticket's detail: its comments, statuses, references, uploads, data requests and assignees.
 *
 * @param {TicketAccessScope} scope The endpoints the ticket is read through.
 * @param {string} ticketId The ticket.
 * @returns The ticket detail key.
 */
const detail = (scope: TicketAccessScope, ticketId: string) => [...all(scope), 'detail', ticketId] as const;

/**
 * Key prefix of every page of a ticket's files.
 *
 * @param {string} ticketId The ticket.
 * @returns The ticket artifacts key prefix.
 */
const artifactsAll = (ticketId: string) => [QUERY_KEY_ROOT.TICKET, 'artifacts', ticketId] as const;

/**
 * Key of one page of a ticket's files; files are read through the administrative endpoints only.
 *
 * @param {string} ticketId The ticket.
 * @param {IGetTicketArtifactsQueryParams} params The search, page and sort sent.
 * @returns The ticket artifacts key.
 */
const artifacts = (ticketId: string, params: IGetTicketArtifactsQueryParams) =>
  [...artifactsAll(ticketId), params] as const;

/**
 * Query keys for tickets, ordered from broad to narrow so that each prefix names the set of queries a
 * change invalidates.
 */
export const ticketQueryKeys = { all, lists, list, detail, artifactsAll, artifacts };
