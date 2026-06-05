import { getNumberEnv } from '../utils/env-utils';

/**
 * Anchor rows processed per keyset page in security-scope anchor maintenance.
 */
export const SECURITY_SCOPE_ANCHOR_BATCH_SIZE = getNumberEnv('SECURITY_SCOPE_ANCHOR_BATCH_SIZE', 5000);
