import { useCallback, useEffect, useState } from 'react';
import { useAsync } from './useAsync';
import useIsMounted from './useIsMounted';

export type DataLoader<T = unknown, R = unknown> = {
  /**
   * The response of the `fetchData` call.
   *
   * @type {(T | undefined)}
   */
  data: T | undefined;
  /**
   * The error caught if the `fetchData` call throws.
   *
   * @type {(R | unknown)}
   */
  error: R | unknown;
  /**
   * `true` if the `fetchData` function is currently executing.
   *
   * @type {boolean}
   */
  isLoading: boolean;
  /**
   * `true` if the `fetchData` function has finished executing.
   *
   * @type {boolean}
   */
  isReady: boolean;
  /**
   * Executes the `fetchData` function again.
   */
  refresh: () => void;
};

/**
 * Hook that wraps an async function.
 *
 * Note: This hook will prevent additional calls to `fetchData` if an existing call is in progress.
 *
 * @export
 * @template T
 * @template R
 * @param {() => Promise<T>} fetchData An async function.
 * @param {((error: R | unknown) => void)} [onError] An optional error handler function that will be called if the
 * `fetchData` function throws an error.
 * @return {*}  {DataLoader<T, R>}
 */
export default function useDataLoader<T = unknown, R = unknown>(
  fetchData: () => Promise<T>,
  onError?: (error: R | unknown) => void
): DataLoader<T, R> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<R | unknown>();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isMounted = useIsMounted();

  const getData = useAsync(fetchData);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await getData();

      if (!isMounted) {
        return;
      }

      setData(response);
    } catch (error) {
      if (!isMounted) {
        return;
      }

      setError(error);

      onError?.(error);
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }, [getData, onError, isMounted]);

  useEffect(() => {
    if (data || error) {
      return;
    }

    loadData();
  }, [data, error, getData, loadData]);

  const refresh = () => {
    setError(undefined);
    setIsLoading(false);
    setIsReady(false);
    loadData();
  };

  return { data, error, isLoading, isReady, refresh };
}
