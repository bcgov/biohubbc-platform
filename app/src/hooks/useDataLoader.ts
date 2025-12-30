import { useState } from 'react';
import { AsyncFunction, useAsync } from './useAsync';
import useIsMounted from './useIsMounted';

export type DataLoader<AFArgs extends any[], AFResponse = unknown, AFError = unknown> = {
  data: AFResponse | undefined;
  error: AFError | unknown;
  isLoading: boolean;
  isReady: boolean;
  load: (...args: AFArgs) => Promise<AFResponse | undefined>;
  refresh: (...args: AFArgs) => Promise<AFResponse | undefined>;
  clear: () => void;
  setData: (data: AFResponse) => void;
};

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

  const loadData = async (...args: AFArgs): Promise<AFResponse | undefined> => {
    try {
      setIsLoading(true);

      const response = await getData(...args);

      if (!isMounted) {
        return response;
      }

      setData(response);
      return response;
    } catch (error) {
      if (!isMounted) {
        return undefined;
      }

      setError(error);
      onError?.(error);
      return undefined;
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  };

  const load = (...args: AFArgs): Promise<AFResponse | undefined> => {
    if (isOneTimeLoad) {
      return Promise.resolve(data);
    }
    setOneTimeLoad(true);
    return loadData(...args);
  };

  const refresh = (...args: AFArgs): Promise<AFResponse | undefined> => {
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
