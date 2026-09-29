import { QUERY_KEY_ROOT } from 'constants/query-keys';

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
export const userQueryKeys = { available };
