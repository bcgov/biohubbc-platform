import { QueryClient, QueryKey } from '@tanstack/react-query';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from 'constants/query';

/**
 * Creates an isolated QueryClient for one test.
 *
 * Uses the app's defaults, with an infinite `gcTime` so that inactive queries never schedule a garbage
 * collection timer that could outlive the test.
 *
 * @returns {QueryClient} A client whose cache is shared with nothing else.
 */
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: { ...QUERY_CLIENT_DEFAULT_OPTIONS.queries, gcTime: Infinity },
      mutations: { ...QUERY_CLIENT_DEFAULT_OPTIONS.mutations, gcTime: Infinity }
    }
  });
};

/**
 * Spies on a client's `invalidateQueries` and reports which keys it was asked to invalidate.
 *
 * @param {QueryClient} queryClient The client to spy on.
 * @returns {() => (QueryKey | undefined)[]} Reads the invalidated keys so far, in call order.
 */
export const spyOnInvalidatedQueryKeys = (queryClient: QueryClient): (() => (QueryKey | undefined)[]) => {
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey);
};
