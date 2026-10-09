import { QueryObserver } from '@tanstack/react-query';
import { createTestQueryClient } from 'test-helpers/query-client';
import { act, renderHook, waitFor } from 'test-helpers/test-utils';
import { holdReload, useCoordinatedMutation } from './useCoordinatedMutation';

const group = ['changes'];
const key = ['record', 1];

/**
 * Creates a controlled request for settlement-order tests.
 *
 * @returns A promise and its completion function.
 */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it.each([false, true])('reconciles once after overlapping mutations settle (same tick: %s)', async (sameTick) => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(key, 'old');
  const reload = vi.fn().mockResolvedValue('saved');
  const stop = new QueryObserver(queryClient, { queryKey: key, queryFn: reload, staleTime: Infinity }).subscribe(
    () => undefined
  );
  const first = deferred<void>();
  const second = deferred<void>();
  const request = vi.fn((index: number) => (index === 1 ? first.promise : second.promise));
  const { result } = renderHook(
    () =>
      useCoordinatedMutation({
        mutationKey: group,
        mutationFn: request,
        onSuccess: () => holdReload(queryClient, group, key)
      }),
    { queryClient }
  );
  act(() => {
    result.current.mutate(1);
    result.current.mutate(2);
  });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  await act(async () => {
    first.resolve();
    if (sameTick) {
      second.resolve();
    }
  });
  if (!sameTick) {
    expect(reload).not.toHaveBeenCalled();
    await act(async () => second.resolve());
  }
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(reload).toHaveBeenCalledOnce();
  expect(queryClient.getQueryData(key)).toBe('saved');
  stop();
});

it('keeps the last mutation pending until its reconciliation completes', async () => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(key, 'old');
  const read = deferred<string>();
  const reload = vi.fn(() => read.promise);
  const stop = new QueryObserver(queryClient, { queryKey: key, queryFn: reload, staleTime: Infinity }).subscribe(
    () => undefined
  );
  const { result } = renderHook(
    () =>
      useCoordinatedMutation({
        mutationKey: group,
        mutationFn: async () => undefined,
        onSuccess: () => holdReload(queryClient, group, key)
      }),
    { queryClient }
  );
  act(() => result.current.mutate());
  await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  expect(result.current.isPending).toBe(true);
  await act(async () => read.resolve('saved'));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  stop();
});

it.each(['onMutate', 'onSuccess', 'onSettled'] as const)('releases coordination when %s throws', async (callback) => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(key, 'old');
  const reload = vi.fn().mockResolvedValue('saved');
  const stop = new QueryObserver(queryClient, { queryKey: key, queryFn: reload, staleTime: Infinity }).subscribe(
    () => undefined
  );
  const fail = () => {
    throw new Error('callback failed');
  };
  const { result } = renderHook(
    () =>
      useCoordinatedMutation({
        mutationKey: group,
        mutationFn: async () => undefined,
        onMutate: () => {
          holdReload(queryClient, group, key);
          if (callback === 'onMutate') {
            fail();
          }
        },
        onSuccess: () => {
          if (callback === 'onSuccess') {
            fail();
          }
        },
        onSettled: () => {
          if (callback === 'onSettled') {
            fail();
          }
        }
      }),
    { queryClient }
  );
  await act(async () => {
    await expect(result.current.mutateAsync()).rejects.toThrow();
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(reload).toHaveBeenCalledOnce();
  // A subsequent mutation must not inherit a leaked registration.
  const next = renderHook(
    () =>
      useCoordinatedMutation({
        mutationKey: group,
        mutationFn: async () => undefined,
        onSuccess: () => holdReload(queryClient, group, key)
      }),
    { queryClient }
  );
  await act(async () => {
    await next.result.current.mutateAsync();
  });
  expect(reload).toHaveBeenCalledTimes(2);
  stop();
});

it.each([false, true])('coalesces exact and prefix refreshes (prefix first: %s)', async (prefixFirst) => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(key, 'old');
  const read = deferred<string>();
  const reload = vi.fn(() => read.promise);
  const stop = new QueryObserver(queryClient, { queryKey: key, queryFn: reload, staleTime: Infinity }).subscribe(
    () => undefined
  );
  const { result } = renderHook(
    () =>
      useCoordinatedMutation({
        mutationKey: group,
        mutationFn: async () => undefined,
        onSuccess: () => {
          if (prefixFirst) {
            holdReload(queryClient, group, ['record'], false);
          }
          holdReload(queryClient, group, key);
          if (!prefixFirst) {
            holdReload(queryClient, group, ['record'], false);
          }
        }
      }),
    { queryClient }
  );
  act(() => result.current.mutate());
  await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  await act(async () => read.resolve('saved'));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(reload).toHaveBeenCalledOnce();
  stop();
});
