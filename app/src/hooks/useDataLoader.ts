import { useState } from 'react';
import { AsyncFunction, useAsync } from './useAsync';
import useIsMounted from './useIsMounted';

export type DataLoader<Q extends any[], T = unknown, R = unknown> = {
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
   * Executes the `fetchData` function once, only if it has never been called before. Does nothing if called again.
   */
  load: (...args: Q) => void;
  /**
   * Executes the `fetchData` function again.
   */
  refresh: (...args: Q) => void;
  /**
   * Clears any errors caught from a failed `fetchData` call.
   */
  clear: () => void;
};

/**
 * Hook that wraps an async function.
 *
 * Note: Runs each time `refresh` is called.
 *
 * Note: This hook will prevent additional calls to `fetchData` if an existing call is in progress.
 *
 * @export
 * @template T
 * @template R
 * @param {AsyncFunction<Q, T>} fetchData An async function.
 * @param {((error: R | unknown) => void)} [onError] An optional error handler function that will be called if the
 * `fetchData` function throws an error.
 * - If set to `true`, the `fetchData` function will run on initial load, and each time `refresh` is called.
 * - If set to `false` the `fetchData` function will run each time `refresh` is called.
 * @return {*}  {DataLoader<Q, T, R>}
 */
export default function useDataLoader<Q extends any[], T = unknown, R = unknown>(
  fetchData: AsyncFunction<Q, T>,
  onError?: (error: R | unknown) => void
): DataLoader<Q, T, R> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<R | unknown>();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isOneTimeLoad, setOneTimeLoad] = useState(false);

  const isMounted = useIsMounted();

  const getData = useAsync(fetchData);

  const loadData = async (...args: Q) => {
    try {
      setIsLoading(true);

      const response = await getData(...args);

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
  };

  const load = (...args: Q) => {
    if (isOneTimeLoad) {
      return;
    }

    setOneTimeLoad(true);
    loadData(...args);
  };

  const refresh = (...args: Q) => {
    setError(undefined);
    setIsLoading(false);
    setIsReady(false);
    loadData(...args);
  };

  const clear = () => {
    setError(undefined);
  };

  return { data, error, isLoading, isReady, load, refresh, clear };
}
