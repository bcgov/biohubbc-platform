import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ISystemUsersQueryParams } from 'interfaces/useUserApi.interface';

/**
 * Key of the system roles a user can hold.
 *
 * @returns The roles key.
 */
const roles = () => [QUERY_KEY_ROOT.USER, 'roles'] as const;

/**
 * Key prefix of every page of the system users list.
 *
 * @returns The users list key prefix.
 */
const lists = () => [QUERY_KEY_ROOT.USER, 'list'] as const;

/**
 * Key of one page of the system users list.
 *
 * @param {ISystemUsersQueryParams} params The search, page and sort sent.
 * @returns The users list key.
 */
const list = (params: ISystemUsersQueryParams) => [...lists(), params] as const;

/**
 * Key of the users that can be added to a team, a ticket or a data request, filtered by a search term.
 *
 * @param {string} search The search term sent; empty for every user.
 * @returns The available users key.
 */
const available = (search: string) => [QUERY_KEY_ROOT.USER, 'available', { search }] as const;

/**
 * Query keys for system users.
 */
export const userQueryKeys = { available, roles, lists, list };
