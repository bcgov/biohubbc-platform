import {
  hashKey,
  partialMatchKey,
  MutationKey,
  QueryClient,
  QueryKey,
  useMutation,
  useQueryClient,
  UseMutationOptions,
  MutationFunctionContext
} from '@tanstack/react-query';

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
const registrations = new WeakMap<MutationFunctionContext, MutationKey>();

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
 * Registers a mutation before its optimistic work starts. Only the owning hook calls this.
 *
 * The group keeps its own count rather than asking the client which mutations are pending: a mutation is marked
 * settled only after its `onSettled` returns, so two mutations settling in the same tick would each see the other as
 * still running, and neither would run the reloads held for them.
 *
 * @param {QueryClient} queryClient The client running the mutation.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {void}
 */
const joinMutationGroup = (queryClient: QueryClient, mutationKey: MutationKey): void => {
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
  const reloads = ensureMutationGroup(queryClient, mutationKey).heldReloads;
  for (const [id, held] of reloads) {
    if (!held.exact && partialMatchKey(queryKey, held.queryKey)) {
      return;
    }
    if (!exact && partialMatchKey(held.queryKey, queryKey)) {
      reloads.delete(id);
    }
  }
  reloads.set(heldReloadId(queryKey, exact), { queryKey, exact });
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
  const heldReloads = mutationGroups.get(queryClient)?.get(hashKey(mutationKey))?.heldReloads.values();
  const reloadHeld =
    heldReloads &&
    Array.from(heldReloads).some((held) =>
      held.exact ? hashKey(held.queryKey) === hashKey(queryKey) : partialMatchKey(queryKey, held.queryKey)
    );
  if (!reloadHeld && !hasConcurrentMutations(queryClient, mutationKey)) {
    return false;
  }
  holdReload(queryClient, mutationKey, queryKey);
  return true;
};

/**
 * Counts a mutation out of its group, and once the group's last mutation settles, runs the reloads held for it: copies
 * on screen reload, and inactive copies are dropped. The owning hook always calls this in finally.
 *
 * @param {QueryClient} queryClient The client running the mutations.
 * @param {MutationKey} mutationKey The group's mutation key.
 * @returns {Promise<void>} Resolves after reconciliation when this is the last mutation.
 */
const settleMutationGroup = async (queryClient: QueryClient, mutationKey: MutationKey): Promise<void> => {
  const groups = mutationGroups.get(queryClient);
  const group = groups?.get(hashKey(mutationKey));
  if (!group) {
    return;
  }

  group.running -= 1;
  if (group.running > 0) {
    return;
  }

  groups?.delete(hashKey(mutationKey));
  const refreshes = Array.from(group.heldReloads.values()).map(({ queryKey, exact }) => {
    queryClient.removeQueries({ queryKey, exact, type: 'inactive' });
    return queryClient.invalidateQueries({ queryKey, exact });
  });
  await Promise.all(refreshes);
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
 * Reconciles a query after an external saved operation, respecting an explicitly named mutation group.
 *
 * @param {QueryClient} queryClient Cache client.
 * @param {MutationKey} mutationKey Mutations whose optimistic writes must settle first.
 * @param {QueryKey} queryKey Query to reconcile.
 * @returns {Promise<void>} Resolves after immediate reconciliation, or once reconciliation has been scheduled.
 */
export const reconcileAfterMutations = async (
  queryClient: QueryClient,
  mutationKey: MutationKey,
  queryKey: QueryKey
): Promise<void> => {
  if (runningMutations(queryClient, mutationKey) > 0) {
    holdReload(queryClient, mutationKey, queryKey);
    return;
  }
  await queryClient.invalidateQueries({ queryKey, exact: true });
};

/**
 * Runs mutations that share optimistic cache state and owns their registration and final reconciliation.
 *
 * Callers use normal TanStack callbacks for domain updates. The hook balances registration even when a callback
 * throws, captures the original mutation key, and awaits the final refresh. Earlier overlapping mutations may finish
 * before the group reconciles; waiting for peers inside their callbacks would deadlock settlement.
 *
 * @param {UseMutationOptions<TData, TError, TVariables, TContext> & { mutationKey: MutationKey }} options Mutation callbacks and explicit coordination key.
 * @returns The TanStack mutation result.
 */
export const useCoordinatedMutation = <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & { mutationKey: MutationKey }
) => {
  const queryClient = useQueryClient();
  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onMutate: async (variables, context) => {
      const key = context.mutationKey ?? options.mutationKey;
      registrations.set(context, key);
      joinMutationGroup(queryClient, key);
      return options.onMutate ? await options.onMutate(variables, context) : (undefined as TContext);
    },
    onSettled: async (data, error, variables, result, context) => {
      const key = registrations.get(context);
      // TanStack calls onSettled again through its error path if a successful settlement callback throws.
      if (!key) {
        return;
      }
      try {
        await options.onSettled?.(data, error, variables, result, context);
      } finally {
        registrations.delete(context);
        await settleMutationGroup(queryClient, key);
      }
    }
  });
};
