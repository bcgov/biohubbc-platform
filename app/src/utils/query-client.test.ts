import { QueryClient, QueryKey, QueryObserver } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { refreshChangedQueries } from './query-client';
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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
describe('query-client', () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });
  afterEach(() => queryClient.clear());
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

  it.each([{ except: ['list'] }, { except: ['list', 'detail'] }])(
    'excludes only the exact key $except from invalidation',
    async ({ except }) => {
      const child = [...except, 'child'];
      queryClient.setQueryData(except, 'saved');
      queryClient.setQueryData(child, 'old child');
      const excludedRead = vi.fn().mockResolvedValue('incorrect');
      const childRead = vi.fn().mockResolvedValue('fresh child');
      const stopExcluded = watchQuery(queryClient, except, excludedRead);
      const stopChild = watchQuery(queryClient, child, childRead);
      await refreshChangedQueries(queryClient, [['list']], except);
      expect(excludedRead).not.toHaveBeenCalled();
      expect(childRead).toHaveBeenCalledOnce();
      expect(queryClient.getQueryData(except)).toBe('saved');
      expect(queryClient.getQueryData(child)).toBe('fresh child');
      stopExcluded();
      stopChild();
    }
  );
});
