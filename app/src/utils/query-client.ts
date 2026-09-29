import { QueryClient } from '@tanstack/react-query';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from 'constants/query';

/**
 * Creates the QueryClient that holds the app's server state.
 *
 * @returns {QueryClient} A client configured with the app's default query and mutation options.
 */
export const createAppQueryClient = (): QueryClient => {
  return new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS });
};
