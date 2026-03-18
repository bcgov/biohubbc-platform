import { useCallback } from 'react';
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
  const { handleMutation } = useOptimisticMutation<TData>({
    getData: () => dataLoader.data as TData,
    setData: dataLoader.setData
  });

  /**
   * Runs an optimistic refresh when current data is available.
   *
   * Returns `undefined` when `dataLoader.data` has not been loaded yet.
   */
  const refresh = useCallback(
    async <TApiResult>(
      buildConfig: (currentData: TData) => IOptimisticMutationConfig<TData, TApiResult>
    ): Promise<TApiResult | undefined> => {
      if (dataLoader.data === undefined) {
        return undefined;
      }

      return handleMutation(buildConfig);
    },
    [dataLoader.data, handleMutation]
  );

  return { refresh };
};
