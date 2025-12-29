import { useState } from 'react';
import { AsyncFunction, useAsync } from './useAsync';
import useIsMounted from './useIsMounted';

export type DataLoader<AFArgs extends any[], AFResponse = unknown, AFError = unknown> = {
  /**
   * The response of the `fetchData` call.
   *
   * @type {(AFResponse | undefined)}
   */
  data: AFResponse | undefined;
  /**
   * The error caught if the `fetchData` call throws.
   *
   * @type {(AFError | unknown)}
   */
  error: AFError | unknown;
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
  load: (...args: AFArgs) => Promise<AFResponse>;
  /**
   * Executes the `fetchData` function again.
   */
  refresh: (...args: AFArgs) => Promise<AFResponse>;
  /**
   * Clears any errors caught from a failed `fetchData` call.
   */
  clear: () => void;
  /**
   * Setter for manually handling data. Useful for sorting
   */
  setData: (data: AFResponse) => void;
};

/**
 * Hook that wraps an async function.
 *
 * Note: Runs each time `refresh` is called.
 *
 * Note: This hook will prevent additional calls to `fetchData` if an existing call is in progress.
 *
 * @export
 * @template AFArgs `AsyncFunction` argument types.
 * @template AFResponse `AsyncFunction` response type.
 * @template AFError `AsyncFunction` error type.
 * @param {AsyncFunction<AFArgs, AFResponse>} fetchData An async function.
 * @param {((error: AFError | unknown) => void)} [onError] An optional error handler function that will be called if the
 * `fetchData` function throws an error.
 * - If set to `true`, the `fetchData` function will run on initial load, and each time `refresh` is called.
 * - If set to `false` the `fetchData` function will run each time `refresh` is called.
 * @return {*}  {DataLoader<AFArgs, AFResponse, AFError>}
 */
export default function useDataLoader<AFArgs extends any[], AFResponse = unknown, AFError = unknown>(
  fetchData: AsyncFunction<AFArgs, AFResponse>,
  onError?: (error: AFError | unknown) => void
): DataLoader<AFArgs, AFResponse, AFError> {
  const [data, setData] = useState<AFResponse>();
  const [error, setError] = useState<AFError | unknown>();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isOneTimeLoad, setOneTimeLoad] = useState(false);
  const isMounted = useIsMounted();
  const getData = useAsync(fetchData);

  const loadData = async (...args: AFArgs): Promise<AFResponse> => {
    try {
      setIsLoading(true);
      const response = await getData(...args);
      if (isMounted()) {
        setData(response);
      }
      return response;
    } catch (error) {
      if (isMounted()) {
        setError(error);
      }
      onError?.(error);
      throw error;
    } finally {
      if (isMounted()) {
        setIsLoading(false);
        setIsReady(true);
      }
    }
  };

  const load = async (...args: AFArgs): Promise<AFResponse> => {
    if (isOneTimeLoad) {
      return data as AFResponse;
    }
    setOneTimeLoad(true);
    return loadData(...args);
  };

  const refresh = async (...args: AFArgs): Promise<AFResponse> => {
    setError(undefined);
    setIsLoading(false);
    setIsReady(false);
    return loadData(...args);
  };

  const clear = () => {
    setError(undefined);
  };

  return { data, error, isLoading, isReady, load, refresh, clear, setData };
}
