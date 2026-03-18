import { useCallback, useRef } from 'react';
import type { DataLoader } from './useDataLoader';
import type { IOptimisticMutationConfig } from './useOptimisticMutation';
import { useOptimisticMutation } from './useOptimisticMutation';

type DataLoaderLike<TData> = Pick<DataLoader<any[], TData, unknown>, 'data' | 'setData'>;

/**
 * DataLoader adapter for optimistic updates.
 *
 * Mirrors `useDataLoader` style by exposing `refresh`, while delegating the
 * optimistic lifecycle to `useOptimisticMutation`.
 */
export const useOptimisticDataLoader = <TData>(dataLoader: DataLoaderLike<TData>) => {
  const dataRef = useRef(dataLoader.data);
  dataRef.current = dataLoader.data;

  const setDataRef = useRef(dataLoader.setData);
  setDataRef.current = dataLoader.setData;

  const { handleMutation } = useOptimisticMutation<TData>({
    getData: () => dataRef.current as TData,
    setData: (nextState) => setDataRef.current(nextState)
  });

  const refresh = useCallback(
    async <TApiResult>(
      buildConfig: (currentData: TData) => IOptimisticMutationConfig<TData, TApiResult>
    ): Promise<TApiResult | undefined> => {
      if (dataRef.current === undefined) {
        return undefined;
      }
      return handleMutation(buildConfig);
    },
    [handleMutation]
  );

  return { refresh };
};
