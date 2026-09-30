import { MutationObserver, QueryClient, QueryKey, QueryObserver } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import {
  hasConcurrentMutations,
  holdReload,
  holdReloadIfConcurrent,
  joinMutationGroup,
  refreshChangedQueries,
  setSavedQueryData,
  settleMutationGroup
} from './query-client';

const GROUP = ['record', 'changes'] as const;
const RECORD = ['record', 1] as const;

/**
 * Returns a promise with its resolve function exposed.
 *
 * @returns The promise and its resolve function.
 */
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
};

/**
 * Subscribes to a query the way a mounted component does, so the client treats it as on screen.
 *
 * @param {QueryClient} queryClient The client holding the query.
 * @param {QueryKey} queryKey The query's key.
 * @param {() => Promise<string>} queryFn Loads the query.
 * @returns {() => void} Unsubscribes, leaving the query cached but off screen.
 */
const watchQuery = (queryClient: QueryClient, queryKey: QueryKey, queryFn: () => Promise<string>) =>
  new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity }).subscribe(() => undefined);

/**
 * Starts one mutation of the test group that holds a reload of the record on success.
 *
 * @param {QueryClient} queryClient The client running the mutation.
 * @param {Promise<void>} saved Settles when the mutation's request does.
 * @returns {Promise<void>} Settles once the mutation has, callbacks included.
 */
const runGroupMutation = (queryClient: QueryClient, saved: Promise<void>) =>
  new MutationObserver(queryClient, {
    mutationKey: GROUP,
    mutationFn: () => saved,
    onMutate: () => joinMutationGroup(queryClient, GROUP),
    onSuccess: () => holdReload(queryClient, GROUP, RECORD),
    onSettled: () => settleMutationGroup(queryClient, GROUP)
  }).mutate(undefined);

/**
 * Lets pending promises and the client's update notifications run.
 *
 * @returns {Promise<void>} Resolves once they have.
 */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('query-client', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('mutation groups', () => {
    it('holds a reload while another mutation of the group is running, and runs it once after the last', async () => {
      const load = vi.fn().mockResolvedValue('record');
      const unsubscribe = watchQuery(queryClient, RECORD, load);
      await flush();
      const first = deferred();
      const second = deferred();

      const settled = [runGroupMutation(queryClient, first.promise), runGroupMutation(queryClient, second.promise)];
      first.resolve();
      await settled[0];
      await flush();
      expect(load).toHaveBeenCalledTimes(1);

      second.resolve();
      await settled[1];
      await flush();
      expect(load).toHaveBeenCalledTimes(2);
      unsubscribe();
    });

    it("runs the held reload when the group's mutations settle in the same tick", async () => {
      const load = vi.fn().mockResolvedValue('record');
      const unsubscribe = watchQuery(queryClient, RECORD, load);
      await flush();
      const saved = deferred();

      const settled = [runGroupMutation(queryClient, saved.promise), runGroupMutation(queryClient, saved.promise)];
      saved.resolve();
      await Promise.all(settled);
      await flush();

      expect(load).toHaveBeenCalledTimes(2);
      unsubscribe();
    });

    it('reports concurrency only while another mutation of the group is running', () => {
      joinMutationGroup(queryClient, GROUP);
      expect(hasConcurrentMutations(queryClient, GROUP)).toBe(false);
      expect(holdReloadIfConcurrent(queryClient, GROUP, RECORD)).toBe(false);

      joinMutationGroup(queryClient, GROUP);
      expect(hasConcurrentMutations(queryClient, GROUP)).toBe(true);
      expect(holdReloadIfConcurrent(queryClient, GROUP, RECORD)).toBe(true);

      settleMutationGroup(queryClient, GROUP);
      expect(hasConcurrentMutations(queryClient, GROUP)).toBe(false);
      settleMutationGroup(queryClient, GROUP);
    });
  });

  describe('refreshChangedQueries', () => {
    it('drops a copy no component is showing and reloads a copy on screen', async () => {
      queryClient.setQueryData(['list', 'page-2'], 'old page 2');
      const load = vi.fn().mockResolvedValue('new page 1');
      const unsubscribe = watchQuery(queryClient, ['list', 'page-1'], load);
      await flush();

      refreshChangedQueries(queryClient, [['list']]);
      await flush();

      expect(queryClient.getQueryData(['list', 'page-2'])).toBeUndefined();
      expect(load).toHaveBeenCalledTimes(2);
      unsubscribe();
    });

    it('leaves the excepted query alone and drops the other queries under it', async () => {
      queryClient.setQueryData(['list'], 'written by the change');
      queryClient.setQueryData(['list', 'page-2'], 'old page 2');

      refreshChangedQueries(queryClient, [['list']], ['list']);
      await flush();

      expect(queryClient.getQueryData(['list'])).toBe('written by the change');
      expect(queryClient.getQueryData(['list', 'page-2'])).toBeUndefined();
    });
  });

  describe('setSavedQueryData', () => {
    it('repeats a load already in flight, so the load cannot overwrite the saved change', async () => {
      const staleLoad = deferred<string>();
      const load = vi.fn().mockReturnValueOnce(staleLoad.promise).mockResolvedValue('saved');
      const unsubscribe = watchQuery(queryClient, RECORD, load);

      await setSavedQueryData<string>(queryClient, RECORD, () => 'saved');
      staleLoad.resolve('before the change');
      await flush();

      expect(queryClient.getQueryData(RECORD)).toBe('saved');
      expect(load).toHaveBeenCalledTimes(2);
      unsubscribe();
    });

    it('holds the repeated load until the mutations writing to the query have settled', async () => {
      const staleLoad = deferred<string>();
      const load = vi.fn().mockReturnValueOnce(staleLoad.promise).mockResolvedValue('saved');
      const unsubscribe = watchQuery(queryClient, RECORD, load);
      joinMutationGroup(queryClient, RECORD);

      await setSavedQueryData<string>(queryClient, RECORD, () => 'saved');
      await flush();
      expect(load).toHaveBeenCalledTimes(1);

      settleMutationGroup(queryClient, RECORD);
      await flush();
      expect(load).toHaveBeenCalledTimes(2);
      unsubscribe();
    });
  });
});
