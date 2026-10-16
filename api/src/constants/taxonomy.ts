import { getNumberEnv } from '../utils/env-utils';

/**
 * TSNs included per ITIS Solr lookup request.
 */
export const ITIS_TSN_LOOKUP_BATCH_SIZE = getNumberEnv('ITIS_TSN_LOOKUP_BATCH_SIZE', 100);

/**
 * Delay between sequential ITIS Solr lookup requests.
 */
export const ITIS_TSN_LOOKUP_DELAY_MS = getNumberEnv('ITIS_TSN_LOOKUP_DELAY_MS', 1000);

/**
 * Maximum time to wait for one ITIS Solr response.
 *
 * Taxon lookups run inside feature indexing transactions, so a request that never completes must fail the attempt
 * rather than hold the transaction open indefinitely.
 */
export const ITIS_REQUEST_TIMEOUT_MS = getNumberEnv('ITIS_REQUEST_TIMEOUT_MS', 30000);
