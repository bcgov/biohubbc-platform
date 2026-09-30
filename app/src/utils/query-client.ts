import { hashKey, MutationKey, Query, QueryClient, QueryKey, Updater } from '@tanstack/react-query';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from 'constants/query';

/** A reload held until a mutation group settles: one query, or every query under a key prefix. */
interface HeldReload {
  queryKey: QueryKey;
  exact: boolean;
}

/** The mutations of a group that have started and not yet settled, and the reloads held until they have. */
interface MutationGroupState {
  running: number;
  heldReloads: Map<string, HeldReload>;
}

/** Mutation groups, by client, then by the group's mutation key. */
const mutationGroups = new WeakMap<QueryClient, Map<string, MutationGroupState>>();

/**
 * Creates the QueryClient that holds the app's server state.
 *
 * @returns {QueryClient} A client configured with the app's default query and mutation options.
 */
export const createAppQueryClient = (): QueryClient => {
  return new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS });
};

/**
 * Finds or starts the state of one mutation group.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {MutationGroupState} The group's state.
 */
const ensureMutationGroup = (queryClient: QueryClient, mutationKey: MutationKey): MutationGroupState => {
  const groups = mutationGroups.get(queryClient) ?? new Map<string, MutationGroupState>();
  mutationGroups.set(queryClient, groups);
  const group = groups.get(hashKey(mutationKey)) ?? { running: 0, heldReloads: new Map<string, HeldReload>() };
  groups.set(hashKey(mutationKey), group);
  return group;
};

/**
 * The number of a group's mutations that have started and not yet settled.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {number} The mutations still running.
 */
const runningMutations = (queryClient: QueryClient, mutationKey: MutationKey): number =>
  mutationGroups.get(queryClient)?.get(hashKey(mutationKey))?.running ?? 0;

/**
 * Identifies a held reload within its group, so one reload is held per query or prefix however often it is asked for.
 *
 * @param {QueryKey} queryKey The query, or prefix, to reload.
 * @param {boolean} exact Whether `queryKey` names one query rather than a prefix.
 * @returns {string} The held reload's id.
 */
const heldReloadId = (queryKey: QueryKey, exact: boolean): string => `${exact}:${hashKey(queryKey)}`;

/**
 * Counts a mutation into its group. Call it first in `onMutate` of every mutation of the group, and
 * {@link settleMutationGroup} in its `onSettled`.
 *
 * The group keeps its own count rather than asking the client which mutations are pending: a mutation is marked
 * settled only after its `onSettled` returns, so two mutations settling in the same tick would each see the other as
 * still running, and neither would run the reloads held for them.
 *
 * @param {QueryClient} queryClient The client running the mutation.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {void}
 */
export const joinMutationGroup = (queryClient: QueryClient, mutationKey: MutationKey): void => {
  ensureMutationGroup(queryClient, mutationKey).running += 1;
};

/**
 * Whether other mutations of a group are running alongside the one calling this. Call it from a mutation's own
 * callbacks, between {@link joinMutationGroup} and {@link settleMutationGroup}.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {boolean} True when another mutation of the group has not settled.
 */
export const hasConcurrentMutations = (queryClient: QueryClient, mutationKey: MutationKey): boolean =>
  runningMutations(queryClient, mutationKey) > 1;

/**
 * Holds a reload until every mutation of a group has settled; {@link settleMutationGroup} runs it.
 *
 * A reload started while another mutation of the group is still being saved returns the data without that change and
 * shows it until the next reload, so the reloads a group needs run once, after its last mutation.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @param {QueryKey} queryKey The query to reload, or the prefix of the queries to reload.
 * @param {boolean} [exact=true] Whether `queryKey` names one query rather than a prefix.
 * @returns {void}
 */
export const holdReload = (
  queryClient: QueryClient,
  mutationKey: MutationKey,
  queryKey: QueryKey,
  exact = true
): void => {
  ensureMutationGroup(queryClient, mutationKey).heldReloads.set(heldReloadId(queryKey, exact), { queryKey, exact });
};

/**
 * Holds a reload of a query when other mutations of its group are still running, or have run alongside this one and
 * already hold a reload of it. A response saved alongside other changes may predate them, and the order responses
 * arrive in says nothing about the order the changes were saved, so the caller writes its response only when this
 * returns false; otherwise the query reloads once the group settles.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @param {QueryKey} queryKey The query the caller would write its response to.
 * @returns {boolean} True when a reload is held in place of the caller's write.
 */
export const holdReloadIfConcurrent = (
  queryClient: QueryClient,
  mutationKey: MutationKey,
  queryKey: QueryKey
): boolean => {
  const reloadHeld = mutationGroups
    .get(queryClient)
    ?.get(hashKey(mutationKey))
    ?.heldReloads.has(heldReloadId(queryKey, true));
  if (!reloadHeld && !hasConcurrentMutations(queryClient, mutationKey)) {
    return false;
  }
  holdReload(queryClient, mutationKey, queryKey);
  return true;
};

/**
 * Counts a mutation out of its group, and once the group's last mutation settles, runs the reloads held for it: copies
 * on screen reload, and copies no component is showing are dropped, as {@link refreshChangedQueries} does. Call it from
 * `onSettled` of every mutation that called {@link joinMutationGroup}.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {void}
 */
export const settleMutationGroup = (queryClient: QueryClient, mutationKey: MutationKey): void => {
  const groups = mutationGroups.get(queryClient);
  const group = groups?.get(hashKey(mutationKey));
  if (!group) {
    return;
  }

  group.running = Math.max(group.running - 1, 0);
  if (group.running > 0) {
    return;
  }

  groups?.delete(hashKey(mutationKey));
  for (const { queryKey, exact } of group.heldReloads.values()) {
    queryClient.removeQueries({ queryKey, exact, type: 'inactive' });
    void queryClient.invalidateQueries({ queryKey, exact });
  }
};

/**
 * Cancels a load of one query ahead of an optimistic update, so the load cannot land afterwards and overwrite
 * the update with state from before the mutation.
 *
 * A cancelled load reverts the query to what it held before, which may be older than what the load would have
 * returned, so the query is reloaded once every mutation of the group has settled.
 *
 * @param {QueryClient} queryClient The client holding the query.
 * @param {QueryKey} queryKey The exact key the optimistic update writes to.
 * @param {MutationKey} mutationKey The key of the mutation group the update belongs to.
 * @returns {Promise<void>} Resolves once the load, if any, is cancelled.
 */
export const cancelQueryForOptimisticUpdate = async (
  queryClient: QueryClient,
  queryKey: QueryKey,
  mutationKey: MutationKey
): Promise<void> => {
  if (queryClient.isFetching({ queryKey, exact: true }) > 0) {
    holdReload(queryClient, mutationKey, queryKey);
  }
  await queryClient.cancelQueries({ queryKey, exact: true });
};

/**
 * Writes a saved change into one query. A load of the query already in flight was requested before the change was
 * saved and would overwrite it with the state from before, so it is cancelled and requested again: at once, or, while
 * mutations of the query's group are running, once they have all settled.
 *
 * @template TData The query's data.
 * @param {QueryClient} queryClient The client holding the query.
 * @param {QueryKey} queryKey The exact key to write, which is also the key of the mutation group that writes to it.
 * @param {Updater<TData | undefined, TData | undefined>} updater Builds the new data from the cached data.
 * @returns {Promise<void>} Resolves once the change is written.
 */
export const setSavedQueryData = async <TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: Updater<TData | undefined, TData | undefined>
): Promise<void> => {
  const cancelledLoad = queryClient.isFetching({ queryKey, exact: true }) > 0;
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueryData<TData>(queryKey, updater);
  if (cancelledLoad) {
    reloadAfterPendingMutations(queryClient, queryKey);
  }
};

/**
 * Reloads one query now, or, while mutations of the query's group are being saved, once they have all settled: a
 * reload started now would return the data without their changes and overwrite what they wrote.
 *
 * @param {QueryClient} queryClient The client holding the query.
 * @param {QueryKey} queryKey The exact key to reload, which is also the key of the mutation group that writes to it.
 * @returns {void}
 */
export const reloadAfterPendingMutations = (queryClient: QueryClient, queryKey: QueryKey): void => {
  if (runningMutations(queryClient, queryKey) > 0) {
    holdReload(queryClient, queryKey, queryKey);
    return;
  }
  void queryClient.invalidateQueries({ queryKey, exact: true });
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
 * @returns {void}
 */
export const refreshChangedQueries = (
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[],
  except?: QueryKey
): void => {
  const exceptHash = except && hashKey(except);
  for (const queryKey of queryKeys) {
    queryClient.removeQueries({ queryKey, type: 'inactive', predicate: (query) => query.queryHash !== exceptHash });
    if (hashKey(queryKey) !== exceptHash) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }
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
