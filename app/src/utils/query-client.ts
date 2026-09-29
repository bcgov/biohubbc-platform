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
 * Cancels a load of one query ahead of an optimistic update, so the load cannot land afterwards and overwrite
 * the update with state from before the mutation.
 *
 * A cancelled load reverts the query to what it held before, which may be older than what the load would have
 * returned. When this reports that a load was cancelled, the mutation invalidates the query once it settles.
 *
 * @param {QueryClient} queryClient The client holding the query.
 * @param {QueryKey} queryKey The exact key the optimistic update writes to.
 * @returns {Promise<boolean>} Whether a load was in flight and has been cancelled.
 */
export const cancelQueryForOptimisticUpdate = async (
  queryClient: QueryClient,
  queryKey: QueryKey
): Promise<boolean> => {
  const cancelledLoad = queryClient.isFetching({ queryKey, exact: true }) > 0;
  await queryClient.cancelQueries({ queryKey, exact: true });
  return cancelledLoad;
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
