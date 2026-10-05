import { hashKey, Query, QueryClient, QueryKey } from '@tanstack/react-query';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from 'constants/query';

/**
 * Creates the QueryClient that holds the app's server state.
 *
 * @returns {QueryClient} A client configured with the app's default query and mutation options.
 */
export const createAppQueryClient = (): QueryClient => {
  return new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS });
};

/**
 * Marks data a change has made out of date wherever it is cached. Copies no component is showing are dropped, so the
 * next page to read them loads them rather than showing the out-of-date copy first; copies on screen are reloaded.
 *
 * @param {QueryClient} queryClient The client holding the queries.
 * @param {QueryKey[]} queryKeys The queries to refresh, each a full key or a prefix; see `changedQueryKeys`.
 * @param {QueryKey} [except] A key in `queryKeys` the change's own mutation keeps up to date, such as the detail it
 * wrote or a list page it patched in place. That query is left alone; other queries under it, such as the list's other
 * pages, are still dropped.
 * @returns {Promise<void>} Resolves after active matching queries finish refreshing.
 */
export const refreshChangedQueries = async (
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[],
  except?: QueryKey
): Promise<void> => {
  const exceptHash = except && hashKey(except);
  const refreshes = queryKeys.map((queryKey) => {
    queryClient.removeQueries({ queryKey, type: 'inactive', predicate: (query) => query.queryHash !== exceptHash });
    return queryClient.invalidateQueries({ queryKey, predicate: (query) => query.queryHash !== exceptHash });
  });
  await Promise.all(refreshes);
};

/**
 * Builds a `placeholderData` option that keeps the previous page on screen while the next one loads, but only when
 * the previous query shares the given key prefix: paging through one feature's properties keeps its rows, while moving
 * to another feature shows the loading state rather than the old feature's rows.
 *
 * @param {QueryKey} scopeKey The key prefix that identifies whose data the query holds.
 * @returns A `placeholderData` function for `useQuery`.
 */
export const keepPreviousDataWithin =
  (scopeKey: QueryKey) =>
  <TData>(previousData: TData | undefined, previousQuery: Query<TData, Error, TData, QueryKey> | undefined) =>
    previousQuery && hashKey(previousQuery.queryKey.slice(0, scopeKey.length)) === hashKey(scopeKey)
      ? previousData
      : undefined;
