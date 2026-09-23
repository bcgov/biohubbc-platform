import type { SearchFeatureSecurityContext } from '../models/search';
import { getNumberEnv } from '../utils/env-utils';

/**
 * Anchor rows processed per keyset page in security-scope anchor maintenance.
 */
export const SECURITY_SCOPE_ANCHOR_BATCH_SIZE = getNumberEnv('SECURITY_SCOPE_ANCHOR_BATCH_SIZE', 5000);

/** Default visibility context for searches without an authenticated caller. */
export const ANONYMOUS_SEARCH_FEATURE_SECURITY_CONTEXT: SearchFeatureSecurityContext = { type: 'anonymous' };
