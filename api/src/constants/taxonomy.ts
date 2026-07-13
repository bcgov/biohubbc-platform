import { getNumberEnv } from '../utils/env-utils';

/**
 * TSNs included per ITIS Solr lookup request.
 */
export const ITIS_TSN_LOOKUP_BATCH_SIZE = getNumberEnv('ITIS_TSN_LOOKUP_BATCH_SIZE', 100);

/**
 * Delay between sequential ITIS Solr lookup requests.
 */
export const ITIS_TSN_LOOKUP_DELAY_MS = getNumberEnv('ITIS_TSN_LOOKUP_DELAY_MS', 1000);
