import { QUERY_KEY_ROOT } from 'constants/query-keys';

/**
 * Key of the signed-in user's active API keys.
 *
 * @returns The API keys key.
 */
const mine = () => [QUERY_KEY_ROOT.API_KEY, 'mine'] as const;

/**
 * Query keys for API keys.
 */
export const apiKeyQueryKeys = { mine };
