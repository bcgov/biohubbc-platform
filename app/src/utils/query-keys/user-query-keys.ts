import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ISystemUsersQueryParams } from 'interfaces/useUserApi.interface';

/**
 * Key prefix of the signed-in user's own record, whatever their token subject.
 *
 * @returns The signed-in user key prefix.
 */
const selfAll = () => [QUERY_KEY_ROOT.USER, 'self'] as const;

/**
 * Key of the signed-in user's own BioHub record.
 *
 * @param {string} subject The token subject that identifies the signed-in user.
 * @returns The signed-in user key.
 */
const self = (subject: string) => [...selfAll(), subject] as const;

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
 * Key prefix of every search of the users that can be added to teams and tickets.
 *
 * @returns The available users key prefix.
 */
const availableAll = () => [QUERY_KEY_ROOT.USER, 'available'] as const;

/**
 * Key of the users that can be added to a team, a ticket or a data request, filtered by a search term.
 *
 * @param {string} search The search term sent; empty for every user.
 * @returns The available users key.
 */
const available = (search: string) => [...availableAll(), { search }] as const;

/**
 * Query keys for system users.
 */
export const userQueryKeys = { availableAll, available, selfAll, self, roles, lists, list };
