import { QUERY_KEY_ROOT } from 'constants/query-keys';

/**
 * Key of every code set: feature types and their properties, and the other lookup values the app offers.
 *
 * @returns The code sets key.
 */
const all = () => [QUERY_KEY_ROOT.CODE, 'all'] as const;

/**
 * Query keys for code sets.
 */
export const codeQueryKeys = { all };
